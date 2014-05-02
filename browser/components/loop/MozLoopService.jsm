/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

this.EXPORTED_SYMBOLS = ["MozLoopService"];

XPCOMUtils.defineLazyModuleGetter(this, "injectLoopAPI",
  "resource:///modules/loop/MozLoopAPI.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "findChromeWindowForChats",
  "resource://gre/modules/MozSocialAPI.jsm");

/**
 * We don't have push notifications on desktop currently, so this is a
 * workaround to get them going for us.
 */
let PushHandlerHack = {
  // This is the uri of the push server.
  pushServerUri: Services.prefs.getCharPref("services.push.serverURL"),
  // This is the channel id we're using for notifications
  channelID: "8b1081ce-9b35-42b5-b8f5-3ff8cb813a50",
  // Stores the push url if we're registered and we have one.
  pushUrl: undefined,

  /**
   * Call to start the connection to the push socket server. On
   * connection, it will automatically say hello and register the channel
   * id with the server.
   *
   * @param {Function} aRegisterCallback Callback to be called once we are
   *                     registered.
   * @param {Function} aNotificationCallback Callback to be called when a
   *                     push notification is received.
   */
  initialize: function(aRegisterCallback, aNotificationCallback) {
    this.registerCallback = aRegisterCallback;
    this.notificationCallback = aNotificationCallback;

    this.websocket = Cc["@mozilla.org/network/protocol;1?name=wss"]
                       .createInstance(Ci.nsIWebSocketChannel);

    this.websocket.protocol = "push-notification";

    var pushURI = Services.io.newURI(this.pushServerUri, null, null);
    this.websocket.asyncOpen(pushURI, this.pushServerUri, this, null);
  },

  /**
   * Listener method, handles the start of the websocket stream.
   * Sends a hello message to the server.
   *
   * @param {nsISupports} aContext Not used
   */
  onStart: function() {
    var helloMsg = { messageType: "hello", uaid: "", channelIDs: [] };
    this.websocket.sendMsg(JSON.stringify(helloMsg));
  },

  /**
   * Listener method, called when the websocket is closed.
   *
   * @param {nsISupports} aContext Not used
   * @param {nsresult} aStatusCode Reason for stopping (NS_OK = successful)
   */
  onStop: function(aContext, aStatusCode) {
    Cu.reportError("Loop Push server web socket closed! Code: " + aStatusCode);
    this.pushUrl = undefined;
  },

  /**
   * Listener method, called when the websocket is closed by the server.
   * If there are errors, onStop may be called without ever calling this
   * method.
   *
   * @param {nsISupports} aContext Not used
   * @param {integer} aCode the websocket closing handshake close code
   * @param {String} aReason the websocket closing handshake close reason
   */
  onServerClose: function() {
    Cu.reportError("Loop Push server web socket closed (server)!");
    this.pushUrl = undefined;
  },

  /**
   * Listener method, called when the websocket receives a message.
   *
   * @param {nsISupports} aContext Not used
   * @param {String} aMsg The message data
   */
  onMessageAvailable: function(e, message) {
    var msg = JSON.parse(message);

    switch(msg.messageType) {
      case "hello":
        this._registerChannel();
        break;
      case "register":
        debugger;
        this.pushUrl = msg.pushEndpoint;
        this.registerCallback(this.pushUrl);
        break;
      case "notification":
        debugger;
        msg.updates.forEach(function(update) {
          if (update.channelID === this.channelID) {
            this.notificationCallback(update.version);
          }
        }.bind(this));
        break;
    }
  },

  /**
   * Handles registering a service
   */
  _registerChannel: function() {
    this.websocket.sendMsg(JSON.stringify({
      messageType: "register",
      channelID: this.channelID
    }));
  }
};

// Internal helper methods and state
let MozLoopServiceInternal = {
  // The uri of the Loop server.
  loopServerUri: Services.prefs.getCharPref("loop.server"),

  // The initial delay for push registration.
  // XXX We keep this short at the moment, as we don't handle delayed
  // registrations from the user perspective. Bug 994151 will extend this.
  pushRegistrationDelay: 60000,

  /**
   * Starts the initialization of the service, which goes and registers
   * with the push server and the loop server.
   */
  initialize: function() {
    if (this.initialized)
      return;

    this.initialized = true;

    // Kick off the push notification service into registering after a timeout
    // so that we're not doing everything straight away at startup
    this.initializeTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.initializeTimer.initWithCallback(this.registerPushHandler.bind(this),
      this.pushRegistrationDelay, Ci.nsITimer.TYPE_ONE_SHOT);
  },

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
  },

  registerPushHandler: function() {
    PushHandlerHack.initialize(this.onPushRegistered.bind(this),
                               this.onHandleNotification.bind(this));
  },

  onPushRegistered: function(aPushUrl) {
    this.registerXhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);

    // XXX Sync!
    // XXX need to handle and report things like DNS lookup failures
    this.registerXhr.open('POST', MozLoopServiceInternal.loopServerUri + "/registration",
                          false);
    this.registerXhr.setRequestHeader('Content-Type', 'application/json');

    // XXX maybe do something less hacky here?  It's not yet obvious to me
    // why mozIThirdPartyUtils is labeling this cookie as foreign; going over
    // the IDL in detail may be enough to figure that.  For now, let's unblock
    // work.
    this.registerXhr.channel.QueryInterface(Ci.nsIHttpChannelInternal);
    this.registerXhr.channel.forceAllowThirdPartyCookie = true;

    this.registerXhr.channel.loadFlags = Ci.nsIChannel.INHIBIT_CACHING
      | Ci.nsIChannel.LOAD_BYPASS_CACHE
      | Ci.nsIChannel.LOAD_EXPLICIT_CREDENTIALS;
    this.registerXhr.sendAsBinary(JSON.stringify({
      simple_push_url: aPushUrl
    }));
  },

  onHandleNotification: function(version) {
    this.openChatWindow(null, "LooP", "about:loopconversation#start/" + version);
  }
};


// Public API
this.MozLoopService = {
  initialize: function() {
    MozLoopServiceInternal.initialize();
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
