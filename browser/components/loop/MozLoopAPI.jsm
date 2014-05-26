/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/loop/MozLoopService.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "hookWindowCloseForPanelClose",
  "resource://gre/modules/MozSocialAPI.jsm");

this.EXPORTED_SYMBOLS = ["injectLoopAPI"];

/**
 * Inject the loop API into the given window.  The caller must be sure the
 * window is a loop content window (eg, a panel, chatwindow, or similar).
 *
 * See the documentation on the individual functions for details of the API.
 *
 * @param {nsIDOMWindow} targetWindow The content window to attach the API.
 */
function injectLoopAPI(targetWindow) {
  let api = {
    /**
     * Returns the url for the Loop server from preferences.
     *
     * @return {String} The Loop server url
     */
    serverUrl: {
      enumerable: true,
      configurable: true,
      get: function() {
        return Services.prefs.getCharPref("loop.server");
      }
    },

    /**
     * Returns the current locale of the browser.
     *
     * @returns {String} The locale string
     */
    locale: {
      enumerable: true,
      configurable: true,
      get: function() {
        return MozLoopService.locale;
      }
    },

    /**
     * Returns translated strings associated with an element. Designed
     * for use with l10n.js
     *
     * @param {String} key The element id
     * @returns {Object} A JSON string containing the localized
     *                   attribute/value pairs for the element.
     */
    getStrings: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(key) {
        return MozLoopService.getStrings(key);
      }
    },

    /**
     * Call to ensure that any necessary registrations for the Loop Service
     * have taken place.
     *
     * Callback parameters:
     * - err null on successful registration, non-null otherwise.
     *
     * @param {Function} callback Will be called once registration is complete,
     *                            or straight away if registration has already
     *                            happened.
     */
    ensureRegistered: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(callback) {
        return MozLoopService.register(callback);
      }
    },

    /**
     * Used to note a call url expiry time. If the time is later than the current
     * latest expiry time, then the stored expiry time is increased. For times
     * sooner, this function is a no-op; this ensures we always have the latest
     * expiry time for a url.
     *
     * This is used to determine whether or not we should be registering with the
     * push server on start.
     *
     * @param {Integer} expiryTimeSeconds The seconds since epoch of the expiry time
     *                                    of the url.
     */
    noteCallUrlExpiry: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(expiryTimeSeconds) {
        MozLoopService.noteCallUrlExpiry(expiryTimeSeconds);
      }
    },

    /**
     * Return any preference under "loop." that's coercible to a character
     * preference.
     *
     * @param {String} prefName The name of the pref without the preceding
     * "loop."
     *
     * Any errors thrown by the Mozilla pref API are logged to the console
     * and cause null to be returned. This includes the case of the preference
     * not being found.
     *
     * @return {String} on success, null on error
     */
    getLoopCharPref: {
      enumerable: true,
      configurable: true,
      writable: true,
      value: function(prefName) {
        MozLoopService.getLoopCharPref(prefName);
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
  hookWindowCloseForPanelClose(targetWindow);
}
