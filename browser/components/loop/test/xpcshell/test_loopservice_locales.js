/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "MozLoopService",
                                  "resource:///modules/loop/MozLoopService.jsm");


function test_locale() {
  // Set the pref to something controlled.
  Services.prefs.setCharPref("general.useragent.locale", "ab-CD");

  do_check_eq(MozLoopService.locale, "ab-CD");

  Services.prefs.clearUserPref("general.useragent.locale");
}

function test_getStrings() {
  // Try an invalid string
  do_check_eq(MozLoopService.getStrings("invalid_not_found_string"), "");

  // Get a string that has sub-items to test the function more fully.
  // XXX This depends on the L10n values, which I'd prefer not to do, but is the
  // simplest way for now.
  do_check_eq(MozLoopService.getStrings("caller"), '{"placeholder":"Identify this call"}');
}

function run_test()
{
  test_locale();
  test_getStrings();
}
