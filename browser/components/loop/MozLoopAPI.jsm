/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/loop/MozLoopService.jsm");

this.EXPORTED_SYMBOLS = ["injectLoopAPI"];

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
        return MozLoopService.locale;
      }
    },

    getStrings: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(key) {
        return MozLoopService.getStrings(key);
      }
    }

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

  // Handle window.close correctly on the panel and chatbox.
  handleWindowClose(targetWindow);
}

// XXX This code is taken directly from MozSocialAPI, we probably really want to share it
function handleWindowClose(targetWindow) {
  let dwu = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowUtils);
  dwu.allowScriptsToClose();

  targetWindow.addEventListener("DOMWindowClose", function _mozLoopDOMWindowClose(evt) {
    let elt = targetWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                .getInterface(Ci.nsIWebNavigation)
                .QueryInterface(Ci.nsIDocShell)
                .chromeEventHandler;
    while (elt) {
      if (elt.localName == "panel") {
        elt.hidePopup();
        break;
      } else if (elt.localName == "chatbox") {
        elt.close();
        break;
      }
      elt = elt.parentNode;
    }
    // preventDefault stops the default window.close() function being called,
    // which doesn't actually close anything but causes things to get into
    // a bad state (an internal 'closed' flag is set and debug builds start
    // asserting as the window is used.).
    // None of the windows we inject this API into are suitable for this
    // default close behaviour, so even if we took no action above, we avoid
    // the default close from doing anything.
    evt.preventDefault();
  }, true);
}
