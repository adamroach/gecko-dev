/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * The "panel" portion of the Loop GUI.
 */

function LoopPanel() {
  window.wrapperPort.onmessage = this.processMessage.bind(this);
  this.sendMessage({operation: "init_done"});
}

LoopPanel.prototype = {
  /**
   * Send a message to the privileged wrapper.
   *
   * @param msg  Object representing the message to send. Must
   *             contain an "operation" attribute. Additional
   *             attributes are optional, and evaluated based on
   *             the operation.
   *
   */
  sendMessage: function(msg) {
    window.wrapperPort.postMessage(JSON.stringify(msg));
  },

  /**
   * Handle a message received from the privileged wrapper.
   *
   * @param msg  JSON-serialized representation of the message. Must
   *             contain an "operation" attribute. Additional
   *             attributes are optional, and evaluated based on
   *             the operation.
   */
  processMessage: function(msg) {
    console.log("Received message from chrome frame: " + msg.data);
  }
};

this.loopPanel = new LoopPanel();
