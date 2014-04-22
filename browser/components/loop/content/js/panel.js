/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global loop:true */

Components.utils.import("resource://gre/modules/Services.jsm");

var loop = loop || {};
loop.panel = (function(_, mozL10n) {
  "use strict";

  var baseServerUrl = Services.prefs.getCharPref("loop.server"),
      sharedViews = loop.shared.views,
      // aliasing translation function as __ for concision
      __ = mozL10n.get;

  /**
   * Panel router.
   * @type {loop.shared.router.BaseRouter}
   */
  var router;

  /**
   * Panel view.
   */
  var PanelView = sharedViews.BaseView.extend({
    template: _.template([
      '<div class="description">',
      '  <p data-l10n-id="get_link_to_share"></p>',
      '</div>',
      '<div class="action">',
      '  <p class="invite">',
      '    <input type="text" name="caller" data-l10n-id="caller">',
      '    <a class="get-url btn btn-success disabled" href=""',
      '       data-l10n-id="get_a_call_url"></a>',
      '  </p>',
      '  <p class="result hide">',
      '    <input id="call-url" type="url" readonly>',
      '    <a class="go-back btn btn-info" href="" data-l10n-id="new_url"></a>',
      '  </p>',
      '</div>',
    ].join("")),

    className: "share generate-url",

    events: {
      "keyup input[name=caller]": "changeButtonState",
      "click a.get-url": "getCallUrl",
      "click a.go-back": "goBack"
    },

    initialize: function(options) {
      options = options || {};
      if (!options.notifier) {
        throw new Error("missing required notifier");
      }
      this.notifier = options.notifier;
      this.client = new loop.shared.Client({
        baseServerUrl: baseServerUrl
      });
    },

    getNickname: function() {
      return this.$("input[name=caller]").val();
    },

    getCallUrl: function(event) {
      event.preventDefault();
      var callback = function(err, callUrl) {
        if (err) {
          this.notifier.errorL10n("unable_retrieve_url");
          return;
        }
        this.onCallUrlReceived(callUrl);
      }.bind(this);

      this.client.requestCallUrl(this.getNickname(), callback);
    },

    goBack: function(event) {
      this.$(".action .result").hide();
      this.$(".action .invite").show();
      this.$(".description p").text(__("get_link_to_share"));
    },

    onCallUrlReceived: function(callUrl) {
      this.notifier.clear();
      this.$(".action .invite").hide();
      this.$(".action .invite input").val("");
      this.$(".action .result input").val(callUrl);
      this.$(".action .result").show();
      this.$(".description p").text(__("share_link_url"));
    },

    changeButtonState: function() {
      var enabled = !!this.$("input[name=caller]").val();
      if (enabled)
        this.$("a.get-url").removeClass("disabled");
      else
        this.$("a.get-url").addClass("disabled");
    }
  });

  var PanelRouter = loop.shared.router.BaseRouter.extend({
    routes: {
      "": "home"
    },

    home: function() {
      this.loadView(new PanelView({notifier: this._notifier}));
    }
  });

  /**
   * Panel initialisation.
   */
  function init() {
    router = new PanelRouter({
      notifier: new sharedViews.NotificationListView({el: "#messages"})
    });
    Backbone.history.start();
  }

  return {
    init: init,
    PanelView: PanelView,
    PanelRouter: PanelRouter
  };
})(_, document.mozL10n);
