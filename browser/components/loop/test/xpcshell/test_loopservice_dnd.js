/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "MozLoopService",
                                  "resource:///modules/loop/MozLoopService.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Chat", "resource:///modules/Chat.jsm");

do_register_cleanup(function() {
  Services.prefs.clearUserPref("loop.do_not_disturb");
});

function test_get_do_not_disturb() {
  Services.prefs.setBoolPref("loop.do_not_disturb", false);

  do_check_false(MozLoopService.doNotDisturb);

  Services.prefs.setBoolPref("loop.do_not_disturb", true);

  do_check_true(MozLoopService.doNotDisturb);
}

function test_set_do_not_disturb() {
  Services.prefs.setBoolPref("loop.do_not_disturb", false);
  MozLoopService.doNotDisturb = true;

  do_check_true(Services.prefs.getBoolPref("loop.do_not_disturb"));
}

// XXX implement & enable me
function test_handlenotification_dnd_on() {
  // XXX stub openChat
  MozLoopService.doNotDisturb = true;

  // XXX trigger an incoming call notification to the service

  do_check_true(stubbedOpenChat);

  // XXX unstub openChat
}

// XXX implement & enable me
function test_handlenotification_dnd_off() {
  var openChatimpl = Chat.open;
  // XXX stub openChat
  var called = false;
  Chat.open = function() {
    called = true;
  };
  MozLoopService.doNotDisturb = false;

  // XXX trigger an incoming call notification to the service

  do_check_false(called, true);

  // XXX unstub openChat
  Chat.open = openChatimpl;
}

function run_test()
{
  test_get_do_not_disturb();
  test_set_do_not_disturb();
  // test_handlenotification_dnd_on();
  // test_handlenotification_dnd_off();
}
