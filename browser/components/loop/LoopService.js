"use strict";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/MozSocialAPI.jsm");
Cu.import("resource://gre/modules/SocialService.jsm");

const loopServerUri = Services.prefs.getCharPref("loop.server");
const pushServerUri = "wss://push.services.mozilla.com";
const channelID = "8b1081ce-9b35-42b5-b8f5-3ff8cb813a50";

function LoopService() {}

LoopService.prototype = {
  classID: Components.ID("{324562fa-325e-449c-a433-2b1e6a3fb145}"),

  _xpcom_factory: XPCOMUtils.generateSingletonFactory(LoopService),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsITimerCallback, Ci.ILoopService]),

  observe: function LS_observe(aSubject, aTopic, aData) {
    if (aTopic != "profile-after-change") {
      Cu.reportError("Unexpected observer notification.");
      return;
    }

    this.startupTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.startupTimer.initWithCallback(this, 500, Ci.nsITimer.TYPE_ONE_SHOT);
  },

  notify: function LS_notify(aTimer) {
    delete this.startupTimer;
    Cu.reportError("Yay!");

    // Get push url
    this.websocket = Cc["@mozilla.org/network/protocol;1?name=wss"]
                       .createInstance(Ci.nsIWebSocketChannel);

    this.websocket.protocol ="push-notification";
    this.websocket.asyncOpen(Services.io.newURI(pushServerUri, null, null), pushServerUri, this, null);
  },

  onStart: function() {
    var helloMsg = { messageType: "hello", uaid: "", channelIDs: []};
    this.websocket.sendMsg(JSON.stringify(helloMsg));
  },

  onStop: function() {
    Cu.reportError("Web socket closed!");
  },

  onServerClose: function() {
    Cu.reportError("Web socket closed (server)!");
  },

  onMessageAvailable: function(e, message) {
    var msg = JSON.parse(message);

    switch(msg.messageType) {
      case "hello":
        this.websocket.sendMsg(JSON.stringify({messageType: "register", channelID: channelID}));
        break;
      case "register":
        this.registerXhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                             .createInstance(Ci.nsIXMLHttpRequest);
        // XXX Sync!
        this.registerXhr.open('POST', loopServerUri + "/registration", false);
        this.registerXhr.setRequestHeader('Content-Type', 'application/json');
        this.registerXhr.channel.loadFlags = Ci.nsIChannel.INHIBIT_CACHING | Ci.nsIChannel.LOAD_BYPASS_CACHE | Ci.nsIChannel.LOAD_EXPLICIT_CREDENTIALS;
        this.registerXhr.sendAsBinary(JSON.stringify({simple_push_url: msg.pushEndpoint}));
        this.callXhr = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
                             .createInstance(Ci.nsIXMLHttpRequest);
        break;
      case "notification":
        msg.updates.forEach(function(update) {
          if (update.channelID === channelID) {
            SocialService.getProvider("chrome://browser/content/loop/", this.openChat.bind(this, update.version));
          }
        }.bind(this));
        break;
    }
  },

  openChat: function(version, provider) {
    let mostRecent = Services.wm.getMostRecentWindow("navigator:browser");
    openChatWindow(mostRecent, provider, "about:loopconversation#start/" + version);
  },

  getStrings: function(key) {
    try {
      if (!this._localizedStrings) {
        this.initLocalisedStrings();
      }
      return JSON.stringify(this._localizedStrings[key] || null);
    } catch (e) {
      Cu.reportError('Unable to retrive localized strings: ' + e);
      return null;
    }
  },

  initLocalisedStrings: function() {
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

    this._localizedStrings = map;
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([LoopService]);
