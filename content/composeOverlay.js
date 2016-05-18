/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
(function() {

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var MimeHeaderParser = Cc['@mozilla.org/messenger/headerparser;1']
                         .getService(Ci.nsIMsgHeaderParser);

var { Services } = Cu.import('resource://gre/modules/Services.jsm');

var BASE = 'extensions.send-to-internals@clear-code.com.';

var SendToInternalsHelper = {
  get bundle() {
    return document.getElementById('sendToInternalsBundle');
  },

  checkInternals : function()
  {
    var internalDomains = Services.prefs.getComplexValue(BASE + 'domains', Ci.nsISupportsString).data;
    internalDomains = internalDomains.split(/[,\|\s]+/)
                                     .map(function(aDomain) {
                                       return aDomain.trim();
                                     })
                                     .filter(function(aDomain) {
                                       return aDomain;
                                     });

    var externals = this.getAllRecipients().filter(function(aAddress) {
      var domain = aAddress.address.split('@')[1];
      return internalDomains.indexOf(domain) < 0;
    }, this);

    if (externals.length !== 0) {
      this.highlightExternals(externals);
      Services.promptService.alert(
        window,
        this.bundle.getString('alert.haveExternals.title'),
        this.bundle.getFormattedString('alert.haveExternals.text', externals.map(function(aAddress) {
          return aAddress.address;
        })
      );
      return false;
    }
    
    return true;
  },

  HIGHLIGHT : 'data-send-to-internals-external-address',

  highlightExternals : function(aExternalAddresses)
  {
    var externalMatcher = null;
    if (aExternalAddresses.length)
      externalMatcher = new RegExp(aExternalAddresses.map(function(aAddress) {
        return aAddress.address.replace(/\./g, '\\.').replace(/\+/g, '\\+');
      }).join('|'));

    Services.console.logStringMessage('highlight externals: '+externalMatcher);

    var addressFields = document.querySelectorAll('.textbox-addressingWidget');
    Array.forEach(addressFields, function(aField) {
      if (externalMatcher && externalMatcher.test(aField.value))
        aField.setAttribute(this.HIGHLIGHT, true);
      else
        aField.removeAttribute(this.HIGHLIGHT);
    }, this);
  },

  getAllRecipients : function()
  {
    var msgCompFields = gMsgCompose.compFields;
    Recipients2CompFields(msgCompFields);
    gMsgCompose.expandMailingLists();
    return this.splitRecipients(msgCompFields.to, 'To')
    		.concat(this.splitRecipients(msgCompFields.cc, 'Cc'))
            .concat(this.splitRecipients(msgCompFields.bcc, 'Bcc'));
  },

  splitRecipients : function(aAddressesSource, aType)
  {
    var addresses = {};
    var names = {};
    var fullNames = {};
    var numAddresses = MimeHeaderParser.parseHeadersWithArray(
                         aAddressesSource, addresses, names, fullNames);
    var recipients = [];
    for (let i = 0; i < numAddresses; i++) {
      let address = addresses.value[i];
      let domain = address.split('@')[1];
      recipients.push({
        address:  address,
        name:     names.value[i],
        fullName: fullNames.value[i],
        type:     aType
      });
    }
    return recipients;
  },

  // command controller
  supportsCommand : function(aCommand)
  {
    switch (aCommand)
    {
      case 'cmd_sendToInternals':
      case 'cmd_sendToInternalsNow':
      case 'cmd_sendToInternalsLater':
        return true;

      default:
        return false;
    }
  },
  isCommandEnabled : function(aCommand)
  {
    switch (aCommand)
    {
      case 'cmd_sendToInternals':
        return defaultController.commands.cmd_sendButton.isEnabled();

      case 'cmd_sendToInternalsNow':
        return defaultController.commands.cmd_sendNow.isEnabled();

      case 'cmd_sendToInternalsLater':
        return defaultController.commands.cmd_sendLater.isEnabled();

      default:
        return false;
    }
  },
  doCommand : function(aCommand)
  {
    switch (aCommand)
    {
      case 'cmd_sendToInternals':
        if (this.checkInternals())
          goDoCommand('cmd_sendButton');
        return;

      case 'cmd_sendToInternalsNow':
        if (this.checkInternals())
          goDoCommand('cmd_sendNow');
        return;

      case 'cmd_sendToInternalsLater':
        if (this.checkInternals())
          goDoCommand('cmd_sendLater');
        return;

      default:
        return false;
    }
  },
  onEvent : function(aEvent)
  {
  }
};
window.SendToInternalsHelper = SendToInternalsHelper;

window.addEventListener('DOMContentLoaded', function SendToInternalsOnLoad(aEvent) {
  window.removeEventListener(aEvent.type, SendToInternalsOnLoad, false);

  top.controllers.appendController(SendToInternalsHelper);

  var toolbar = document.getElementById('composeToolbar2');
  var defaultSet = toolbar.getAttribute('defaultset');
  var currentSet = toolbar.getAttribute('currentset');

  defaultSet = (defaultSet ? (defaultSet + ',') : '' ) + 'spring,button-sendToInternals';
  toolbar.setAttribute('defaultset', defaultSet);
  if (!Services.prefs.getBoolPref(BASE + 'initialized')) {
    Services.prefs.setBoolPref(BASE + 'initialized', true);
    if (currentSet) {
      currentSet = currentSet + ',spring,button-sendToInternals';
      toolbar.setAttribute('currentset', currentSet);
    }
  }

  window.addEventListener('input', function SendToInternalsOnInput(aEvent) {
    var field = aEvent.target;
    if (field.hasAttribute(SendToInternalsHelper.HIGHLIGHT))
      field.removeAttribute(SendToInternalsHelper.HIGHLIGHT);
  }, false);
}, false);

window.__sendToInternals__updateSendCommands = window.updateSendCommands;
window.updateSendCommands = function(aHaveController, ...aArgs) {
  this.__sendToInternals__updateSendCommands(aHaveController, ...aArgs);
  if (aHaveController)
    goUpdateCommand('cmd_sendToInternals');
  else
    goUpdateCommand('cmd_sendToInternals', SendToInternalsHelper.isCommandEnabled('cmd_sendToInternals'));
};

window.__sendToInternals__MessageComposeOfflineStateChanged = window.MessageComposeOfflineStateChanged;
window.MessageComposeOfflineStateChanged = function(aGoingOffline, ...aArgs) {
  this.__sendToInternals__MessageComposeOfflineStateChanged(aGoingOffline, ...aArgs);

  var button = document.getElementById('button-sendToInternals');
  if (aGoingOffline) {
    if (button) {
      button.label = button.getAttribute('later_label');
      button.setAttribute('tooltiptext', button.getAttribute('later_tooltiptext'))
    }
  }
  else {
    if (button) {
      button.label = button.getAttribute('now_label');
      button.setAttribute('tooltiptext', button.getAttribute('now_tooltiptext'))
    }
  }
};

})();
