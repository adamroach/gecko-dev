// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

// the "exported" symbols
let LoopUI;

XPCOMUtils.defineLazyModuleGetter(this, "injectLoopAPI", "resource:///modules/loop/MozLoopAPI.jsm");


(function() {

  LoopUI = {
    openCallPanel: function(event) {
      let panel = document.getElementById("loop-panel");
      let anchor = event.target;
      let iframe = document.getElementById("loop-panel-frame");

      // We inject in DOMContentLoaded as that is before any scripts have tun.
      iframe.addEventListener("DOMContentLoaded", function documentDOMLoaded() {
        iframe.removeEventListener("DOMContentLoaded", documentDOMLoaded, true);
        injectLoopAPI(iframe.contentWindow);

        // XXX We end up with the wrong size here, so this probably needs investigation.
        iframe.contentWindow.addEventListener("loopPanelInitialized",
          function documentLoaded() {
            iframe.contentWindow.removeEventListener("loopPanelInitialized",
                                                     documentLoaded, true);
            sizeSocialPanelToContent(panel, iframe);
          }, true);

      }, true);

      iframe.setAttribute("src", "about:looppanel");
      panel.hidden = false;
      panel.openPopup(anchor, "bottomcenter topright", 0, 0, false, false);
    }
  }
})();
