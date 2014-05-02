/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// See also: docshell/base/nsAboutRedirector.cpp

#include "AboutRedirector.h"
#include "nsNetUtil.h"
#include "nsIScriptSecurityManager.h"
#include "mozilla/ArrayUtils.h"
#include "nsIPrefService.h"

namespace mozilla {
namespace browser {

NS_IMPL_ISUPPORTS1(AboutRedirector, nsIAboutModule)

struct RedirEntry {
  const char* id;
  const char* url;
  const char* principalUriPref;
  uint32_t flags;
};

/*
  Entries which do not have URI_SAFE_FOR_UNTRUSTED_CONTENT will run with chrome
  privileges. This is potentially dangerous. Please use
  URI_SAFE_FOR_UNTRUSTED_CONTENT in the third argument to each map item below
  unless your about: page really needs chrome privileges. Security review is
  required before adding new map entries without
  URI_SAFE_FOR_UNTRUSTED_CONTENT.  Also note, however, that adding
  URI_SAFE_FOR_UNTRUSTED_CONTENT will allow random web sites to link to that
  URI.  Perhaps we should separate the two concepts out...
 */
static RedirEntry kRedirMap[] = {
#ifdef MOZ_SAFE_BROWSING
  { "blocked", "chrome://browser/content/blockedSite.xhtml", nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
#endif
  { "certerror", "chrome://browser/content/certerror/aboutCertError.xhtml",
      nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
  { "socialerror", "chrome://browser/content/aboutSocialError.xhtml", nullptr,
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
  { "tabcrashed", "chrome://browser/content/aboutTabCrashed.xhtml", nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
  { "feeds", "chrome://browser/content/feeds/subscribe.xhtml", nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
  { "privatebrowsing", "chrome://browser/content/aboutPrivateBrowsing.xhtml",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "rights",
#ifdef MOZ_OFFICIAL_BRANDING
    "chrome://global/content/aboutRights.xhtml",
#else
    "chrome://global/content/aboutRights-unbranded.xhtml",
#endif
      nullptr,
      nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT },
  { "robots", "chrome://browser/content/aboutRobots.xhtml", nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT },
  { "sessionrestore", "chrome://browser/content/aboutSessionRestore.xhtml",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "welcomeback", "chrome://browser/content/aboutWelcomeBack.xhtml", nullptr,
    nsIAboutModule::ALLOW_SCRIPT },
#ifdef MOZ_SERVICES_SYNC
  { "sync-progress", "chrome://browser/content/sync/progress.xhtml", nullptr,
    nsIAboutModule::ALLOW_SCRIPT },
  { "sync-tabs", "chrome://browser/content/sync/aboutSyncTabs.xul", nullptr,
    nsIAboutModule::ALLOW_SCRIPT },
#endif
  { "home", "chrome://browser/content/abouthome/aboutHome.xhtml", nullptr,
    nsIAboutModule::URI_SAFE_FOR_UNTRUSTED_CONTENT |
    nsIAboutModule::ALLOW_SCRIPT },
  { "newtab", "chrome://browser/content/newtab/newTab.xul",  nullptr,
    nsIAboutModule::ALLOW_SCRIPT },
  { "permissions", "chrome://browser/content/preferences/aboutPermissions.xul",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "preferences", "chrome://browser/content/preferences/in-content/preferences.xul",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "downloads", "chrome://browser/content/downloads/contentAreaDownloadsView.xul",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
#ifdef MOZ_SERVICES_HEALTHREPORT
  { "healthreport", "chrome://browser/content/abouthealthreport/abouthealth.xhtml",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
#endif
  { "accounts", "chrome://browser/content/aboutaccounts/aboutaccounts.xhtml",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "app-manager", "chrome://browser/content/devtools/app-manager/index.xul",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
  { "customizing", "chrome://browser/content/customizableui/aboutCustomizing.xul",
    nullptr, nsIAboutModule::ALLOW_SCRIPT },
#ifdef MOZ_LOOP
  { "loopconversation", "chrome://browser/content/loop/conversation.html",
    "loop.server", nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
  { "looppanel", "chrome://browser/content/loop/panel.html", "loop.server",
    nsIAboutModule::ALLOW_SCRIPT |
    nsIAboutModule::HIDE_FROM_ABOUTABOUT },
#endif
};
static const int kRedirTotal = ArrayLength(kRedirMap);

static nsAutoCString
GetAboutModuleName(nsIURI *aURI)
{
  nsAutoCString path;
  aURI->GetPath(path);

  int32_t f = path.FindChar('#');
  if (f >= 0)
    path.SetLength(f);

  f = path.FindChar('?');
  if (f >= 0)
    path.SetLength(f);

  ToLowerCase(path);
  return path;
}

NS_IMETHODIMP
AboutRedirector::NewChannel(nsIURI *aURI, nsIChannel **result)
{
  NS_ENSURE_ARG_POINTER(aURI);
  NS_ASSERTION(result, "must not be null");

  nsAutoCString path = GetAboutModuleName(aURI);

  nsresult rv;
  nsCOMPtr<nsIIOService> ioService = do_GetIOService(&rv);
  NS_ENSURE_SUCCESS(rv, rv);

  for (int i = 0; i < kRedirTotal; i++) {
    if (!strcmp(path.get(), kRedirMap[i].id)) {
      nsCOMPtr<nsIChannel> tempChannel;
      rv = ioService->NewChannel(nsDependentCString(kRedirMap[i].url),
                                 nullptr, nullptr, getter_AddRefs(tempChannel));
      NS_ENSURE_SUCCESS(rv, rv);

      tempChannel->SetOriginalURI(aURI);

      if (kRedirMap[i].principalUriPref) {

        // XXX add comment here about why we're using NS_ENSURE_SUCCESS

        nsCOMPtr<nsIPrefBranch> prefs =
          do_GetService(NS_PREFSERVICE_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);

        // XXX does GetCharPref support UTF-8 URIs?  Does it matter?
        nsAutoCString overrideUriString;
        rv = prefs->GetCharPref(kRedirMap[i].principalUriPref,
                                getter_Copies(overrideUriString));
        NS_ENSURE_SUCCESS(rv, rv);
        // XXX what checks should we perform on overrideURIString here?

        nsCOMPtr<nsIURI> overrideUri;
        rv = ioService->NewURI(overrideUriString, nullptr, nullptr,
                               getter_AddRefs(overrideUri));
        NS_ENSURE_SUCCESS(rv, rv);

        nsCOMPtr<nsIScriptSecurityManager> secMan =
          do_GetService(NS_SCRIPTSECURITYMANAGER_CONTRACTID, &rv);
        NS_ENSURE_SUCCESS(rv, rv);

        // XXX probably don't want to default this to setting mozBrowser to true
        nsCOMPtr<nsIPrincipal> principal;
        rv = secMan->GetAppCodebasePrincipal(overrideUri,
          nsIScriptSecurityManager::NO_APP_ID, true,
          getter_AddRefs(principal));
        NS_ENSURE_SUCCESS(rv, rv);

        rv = tempChannel->SetOwner(principal);
        NS_ENSURE_SUCCESS(rv, rv);
      }

      NS_ADDREF(*result = tempChannel);
      return rv;
    }
  }

  return NS_ERROR_ILLEGAL_VALUE;
}

NS_IMETHODIMP
AboutRedirector::GetURIFlags(nsIURI *aURI, uint32_t *result)
{
  NS_ENSURE_ARG_POINTER(aURI);

  nsAutoCString name = GetAboutModuleName(aURI);

  for (int i = 0; i < kRedirTotal; i++) {
    if (name.Equals(kRedirMap[i].id)) {
      *result = kRedirMap[i].flags;
      return NS_OK;
    }
  }

  return NS_ERROR_ILLEGAL_VALUE;
}

nsresult
AboutRedirector::Create(nsISupports *aOuter, REFNSIID aIID, void **result)
{
  AboutRedirector* about = new AboutRedirector();
  if (about == nullptr)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(about);
  nsresult rv = about->QueryInterface(aIID, result);
  NS_RELEASE(about);
  return rv;
}

} // namespace browser
} // namespace mozilla
