/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

this.EXPORTED_SYMBOLS = ["MozLoopService"];

XPCOMUtils.defineLazyModuleGetter(this, "injectLoopAPI", "resource:///modules/loop/MozLoopAPI.jsm");
// We steal a few things from Social - XXX - do something better here.
XPCOMUtils.defineLazyModuleGetter(this, "findChromeWindowForChats", "resource://gre/modules/MozSocialAPI.jsm");

// XXX This is a workaround for not having push notifications on desktop.
let PushHandlerHack = {
  pushServerUri: "wss://push.services.mozilla.com/",
  channelID: "8b1081ce-9b35-42b5-b8f5-3ff8cb813a50",

  initialize: function() {
    this.websocket = Cc["@mozilla.org/network/protocol;1?name=wss"]
                       .createInstance(Ci.nsIWebSocketChannel);

    this.websocket.protocol = "push-notification";

    var pushURI = Services.io.newURI(this.pushServerUri, null, null);
    this.websocket.asyncOpen(pushURI, this.pushServerUri, this, null);
  },

  onStart: function() {
    var helloMsg = { messageType: "hello", uaid: "", channelIDs: [] };
    this.websocket.sendMsg(JSON.stringify(helloMsg));
  },

  onStop: function() {
    Cu.reportError("Loop Push server web socket closed!");
  },

  onServerClose: function() {
    Cu.reportError("Loop Push server web socket closed (server)!");
  },

  onMessageAvailable: function(e, message) {
    var msg = JSON.parse(message);

    switch(msg.messageType) {
      case "hello":
        this.websocket.sendMsg(JSON.stringify({
          messageType: "register",
          channelID: this.channelID
        }));
        break;
      case "register":
        this.registerXhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                             .createInstance(Ci.nsIXMLHttpRequest);

        Cu.reportError(msg.pushEndpoint);
        // XXX Sync!
        this.registerXhr.open('POST', MozLoopServiceInternal.loopServerUri + "/registration",
                              false);
        this.registerXhr.setRequestHeader('Content-Type', 'application/json');
        this.registerXhr.channel.loadFlags = Ci.nsIChannel.INHIBIT_CACHING
                                           | Ci.nsIChannel.LOAD_BYPASS_CACHE
                                           | Ci.nsIChannel.LOAD_EXPLICIT_CREDENTIALS;
        this.registerXhr.sendAsBinary(JSON.stringify({
          simple_push_url: msg.pushEndpoint
        }));
        break;
      case "notification":
        msg.updates.forEach(function(update) {
          if (update.channelID === this.channelID) {
            MozLoopServiceInternal.handleNotification(update.version);
          }
        }.bind(this));
        break;
    }
  }
}

// Internal helper methods and state
let MozLoopServiceInternal = {
  loopServerUri: Services.prefs.getCharPref("loop.server"),

  get localizedStrings() {
    var stringBundle =
      Services.strings.createBundle('chrome://browser/locale/loop/loop.properties');

    var map = {};
    var enumerator = stringBundle.getSimpleEnumeration();
    while (enumerator.hasMoreElements()) {
      var string = enumerator.getNext().QueryInterface(Ci.nsIPropertyElement);
      var key = string.key, property = 'textContent';
      var i = key.lastIndexOf('.');
      if (i >= 0) {
        property = key.substring(i + 1);
        key = key.substring(0, i);
      }
      if (!(key in map))
        map[key] = {};
      map[key][property] = string.value;
    }

    delete this.localizedStrings;
    return this.localizedStrings = map;
  },

  handleNotification: function(version) {
    this.openChatWindow(null, "LooP", "about:loopconversation#start/" + version);
  },

  openChatWindow: function(contentWindow, title, url, callback, mode) {
    let filterCallback = function(window) {
      // any window with a chatbar is good!
      return !!window.document.getElementById("pinnedchats");
    };
    // So I guess the origin is the loop server!?
    let origin = this.loopServerUri;
    let targetWindow = findChromeWindowForChats(contentWindow, filterCallback);
    if (!targetWindow) {
      // XXX me might want to do something else here, like open a new
      // navigator:browser window - later...
      Cu.reportError("Can't find a chrome window that can host chats");
      return;
    }

    url = url.spec || url;

    let chatbar = targetWindow.document.getElementById("pinnedchats");
    chatbar.hidden = false; // should really move this into openChat?
    let chatbox = chatbar.openChat(origin, title, url, mode);
    chatbox.promiseChatCreated.then(
      () => {
        let chatWindow = chatbox.contentWindow;
        injectLoopAPI(chatWindow);
        if (callback) {
          callback(chatWindow);
        }
      }
    );
    // getAttention is ignored if the target window is already foreground, so
    // we can call it unconditionally.
    targetWindow.getAttention();
  }
};


// Public API
this.MozLoopService = {
  initialize: function() {
    if (MozLoopServiceInternal.initialized)
      return;

    PushHandlerHack.initialize();

    MozLoopServiceInternal.initialized = true;
  },

  getStrings: function(key) {
      var stringData = MozLoopServiceInternal.localizedStrings;
      if (!(key in stringData)) {
        Cu.reportError('No string for key: ' + key + 'found');
        return "";
      }

      return JSON.stringify(stringData[key]);
  },

  get locale() {
    try {
      return Services.prefs.getComplexValue("general.useragent.locale",
        Ci.nsISupportsString).data;
    } catch (ex) {
      return "en-US";
    }
  }
};
