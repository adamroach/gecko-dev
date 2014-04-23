/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

this.EXPORTED_SYMBOLS = ["injectLoopAPI", "openChatWindow"];

// We steal a few things from Social - XXX - do something better here.
XPCOMUtils.defineLazyModuleGetter(this, "sizeSocialPanelToContent", "resource:///modules/Social.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "findChromeWindowForChats", "resource://gre/modules/MozSocialAPI.jsm");

/**
 * Inject the loop API into the given window.  The caller must be sure the
 * window is a loop content window (eg, a panel, chatwindow, or similar)
 */
function injectLoopAPI(targetWindow) {
  let api = {
    getCharPref: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(prefName) {
        if (!prefName.startsWith("loop.")) {
          throw new Error("Expected the preference name to start with 'loop.'");
        }

        return Services.prefs.getCharPref(prefName);
      }
    },

    getLocale: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(prefName) {
        try {
          return Services.prefs.getComplexValue("general.useragent.locale",
            Ci.nsISupportsString).data;
        } catch (ex) {
          return "en-US";
        }
      }
    },

    getStrings: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(key) {
        var loopService = Cc["@mozilla.org/browser/loopservice;1"].
          getService(Ci.ILoopService);

        return loopService.getStrings(key);
      }
    },

    openChatWindow: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(toURL, callback) {
        // I guess we need to add the title and mode to the API?
        let title = "LooP";
        let mode = undefined; // just means a "normal" window.
        openChatWindow(targetWindow, title, toURL, callback, mode);
      }
    },

  };

  let contentObj = Cu.createObjectIn(targetWindow);
  Object.defineProperties(contentObj, api);
  Cu.makeObjectPropsNormal(contentObj);

  targetWindow.navigator.wrappedJSObject.__defineGetter__("mozLoop", function() {
    // We do this in a getter, so that we create these objects
    // only on demand (this is a potential concern, since
    // otherwise we might add one per iframe, and keep them
    // alive for as long as the window is alive).
    delete targetWindow.navigator.wrappedJSObject.mozLoop;
    return targetWindow.navigator.wrappedJSObject.mozLoop = contentObj;
  });
}

function openChatWindow(contentWindow, title, url, callback, mode) {
  // So I guess the origin is the loop server!?
  let origin = Services.prefs.getCharPref("loop.service");
  let targetWindow = findChromeWindowForChats(contentWindow);
  url = url.spec || url;
  // The callback is a good opportunity to inject the API
  let thisCallback = function(chatWindow) {
    injectLoopAPI(contentWindow);
    if (callback) {
      callback(contentWindow);
    }
  }
  if (!targetWindow.SocialChatBar.openChat(origin, title, url, thisCallback, mode)) {
    Cu.reportError("Failed to open a social chat window - the chatbar is not available in the target window.");
    return;
  }
  // getAttention is ignored if the target window is already foreground, so
  // we can call it unconditionally.
  targetWindow.getAttention();
}
