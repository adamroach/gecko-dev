/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global loop:true */

var loop = loop || {};
loop.contacts = (function() {
  "use strict";

  var ON_BLOCKED_MAX_RETRIES = 10;

  function ContactsDB(options) {
    options = options || {};
    this.options = {
      dbname: options.dbname       || "LoopContacts",
      storename: options.storename || "contacts",
      version: options.version     || 1
    };

    this.db = undefined;
  }

  ContactsDB.prototype = {
    add: function(contact) {
      return this._load().then(function(db) {
        var promise = new Promise(function(success, error) {
          var store = this._getStore("readwrite");
          var request;

          try {
            request = store.add(contact);
          } catch (err) {
            error(err);
          }

          request.onsuccess = function(event) {
            var storedContact = {};

            // Shallow copy of the contact + id
            for (var key in contact)
              if (contact.hasOwnProperty(key))
                storedContact[key] = contact[key];
            storedContact.id = request.result;

            success(storedContact);
          };

          request.onerror = function(event) {
            error(event.target.error);
          };
        }.bind(this));

        return promise;
      }.bind(this));
    },

    all: function() {
      return this._load().then(function(db) {
        var promise = new Promise(function(success, error) {
          var store   = this._getStore("readonly");
          var cursor  = store.openCursor();
          var records = [];

          cursor.onerror = function(event) {
            error(event.target.errorCode);
          };

          cursor.onsuccess = function(event) {
            var cursor = event.target.result;

            if (cursor) {
              records.push(cursor.value);
              cursor.continue();
            } else {
              success(records);
            }
          };
        }.bind(this));

        return promise;
      }.bind(this));
    },

    update: function(contact) {
      return this._load().then(function(db) {
        var promise = new Promise(function(success, error) {
          var store = this._getStore("readwrite");
          var request;

          try {
            request = store.put(contact);
          } catch (err) {
            error(err);
          }

          request.onsuccess = function(event) {
            success(request.result);
          };

          request.onerror = function(event) {
            error(event.target.error);
          };
        }.bind(this));

        return promise;
      }.bind(this));
    },

    clear: function() {
      return this._load().then(function(db) {
        var promise = new Promise(function(success, error) {
          var store = this._getStore("readwrite");
          var request = store.clear();

          request.onsuccess = function() {
            success();
          };

          request.onerror = function(event) {
            error(event.target.error);
          };
        }.bind(this));

        return promise;
      }.bind(this));
    },

    close: function() {
      if (!this.db)
        return;
      this.db.close();
      delete this.db;
    },

    _load: function() {
      var promise = new Promise(function(success, error) {
        var request = indexedDB.open(this.options.dbname,
                                     this.options.version);

        request.onblocked = function(event) {
          error(event.target.error);
        }.bind(this);

        request.onerror = function(event) {
          error(event.target.errorCode);
        }.bind(this);

        request.onupgradeneeded = function(event) {
          // the success callback will be called by the onsuccess event
          // handler when the whole operation is performed
          this.db = event.target.result;
          this._createStore(this.db);
        }.bind(this);

        request.onsuccess = function(event) {
          this.db = event.target.result;
          success(this.db);
        }.bind(this);
      }.bind(this));

      return promise;
    },

    _createStore: function(db) {
      // XXX: This isn't really very nice, but it isn't important
      // to persist contacts at the moment, so until we have good data
      // that we must do our best to save, we can get away with it.
      if (db.objectStoreNames.contains(this.options.storename))
        db.deleteObjectStore(this.options.storename);

      var store = db.createObjectStore(this.options.storename, {
        keyPath: "id",
        autoIncrement: true
      });
      store.createIndex("email", "email", {unique: false});
      store.createIndex("name", "name", {unique: false});
      return store;
    },

    _getStore: function(mode) {
      return this.db.transaction(this.options.storename, mode)
        .objectStore(this.options.storename);
    }
  };

  return {ContactsDB: ContactsDB};
}());

