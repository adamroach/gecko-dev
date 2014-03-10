/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * A privileged wrapper around an iframe. The wrapper injects a
 * MessageChannel into the iframe's JS context for communication
 * between the iframe and the wrapper.
 *
 * @param templateId The "id" attribute of the template that
 *                   is to be injected into the iframe as its
 *                   body contents.
 *
 * @param iframeId   The "id" attribute of the iframe that the
 *                   wrapper is to inject the contents into and
 *                   communicate with.
 */

function LoopWrapper(templateId, iframeId) {
  this.template = document.getElementById(templateId);
  this.iframe = document.getElementById(iframeId);
  var documentFragment = this.template.content.cloneNode(true);
  this.iframe.contentDocument.body.appendChild(documentFragment);
  this.messageChannel = this.iframe.contentWindow.MessageChannel();
  Object.defineProperty(this.iframe.contentWindow.wrappedJSObject,
                          "wrapperPort",
                          {
                            value: this.messageChannel.port2
                          });
  this.messageChannel.port1.onmessage = this.processMessage.bind(this);
}

LoopWrapper.prototype = {
  /**
   * Send a message to the wrapped iframe
   *
   * @param msg  Object representing the message to send. Must
   *             contain an "operation" attribute. Additional
   *             attributes are optional, and evaluated based on
   *             the operation.
   */
  sendMessage: function(msg) {
    this.messageChannel.port1.postMessage(JSON.stringify(msg));
  },

  /**
   * Handle a message received from the wrapped iframe
   *
   * @param msg  JSON-serialized representation of the message. Must
   *             contain an "operation" attribute. Additional
   *             attributes are optional, and evaluated based on
   *             the operation.
   */
  processMessage: function(msg) {
    var message = JSON.parse(msg.data);
    console.log("Received message from content frame: " + msg.data);
    if (message.operation == "init_done") {
      this.sendMessage({operation: "init_ack"});
    }
  }

};
