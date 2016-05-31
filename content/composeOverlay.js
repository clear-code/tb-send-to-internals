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

function log(...aArgs) {
  if (Services.prefs.getBoolPref(BASE+'debug'))
    Services.console.logStringMessage('send-to-internals: '+aArgs.join(', '));
}

var SendToInternalsHelper = {
  get bundle() {
    return document.getElementById('sendToInternalsBundle');
  },

  get internalDomains() {
    var internalDomains = Services.prefs.getComplexValue(BASE + 'domains', Ci.nsISupportsString).data;
    log('(raw internalDomains: '+internalDomains+')');
    return internalDomains
             .split(/[,\|\s]+/)
             .map(function(aDomain) {
               return aDomain.trim();
             })
             .filter(function(aDomain) {
               return aDomain;
             });
  },

  get internalMatcher() {
    var expression = this.internalDomains.map(function(aDomain) {
          return '@' + aDomain.replace(/^@^/, '').replace(/\./g, '\\.').replace(/\+/g, '\\+');
        }).join('|')
    return new RegExp(expression);
  },

  get lastField() {
    var dummyRow = awGetNextDummyRow();
    if (dummyRow)
      return dummyRow.previousSibling;

    var listbox = document.getElementById('addressingWidget');
    return listbox.lastChild;
  },

  checkInternals : function()
  {
    log('checkInternals');
    var internalDomains = this.internalDomains;
    log('internalDomains: '+internalDomains);
    var externals = this.getAllRecipients().filter(function(aAddress, aIndex) {
      log('recipient '+aIndex+' / '+aAddress.address);
      var domain = aAddress.address.split('@')[1];
      log('  domain = '+domain);
      var index = internalDomains.indexOf(domain);
      log('  index = '+index);
      return index < 0;
    }, this);

    log('externals = '+externals.length);
    if (externals.length !== 0) {
      this.highlightExternals();
      Services.prompt.alert(
        window,
        this.bundle.getString('alert.haveExternals.title'),
        this.bundle.getFormattedString('alert.haveExternals.text', externals.map(function(aAddress) {
          return aAddress.address;
        }))
      );
      return false;
    }
    
    return true;
  },

  highlightExternals : function()
  {
    log('highlightExternals');
    var addressFields = document.querySelectorAll('.textbox-addressingWidget');
    log('  addressFields = ' + addressFields.length);
    Array.forEach(addressFields, this.updateExternalHighlight, this);
  },

  HIGHLIGHT : 'data-send-to-internals-external-address',

  updateExternalHighlight : function(aField)
  {
    var matcher = this.internalMatcher;
    var value = aField.value.trim();
    log('updateExternalHighlight ' + aField.id + ' / ' + value + ' (' + matcher.test(value) + ')');
    if (value && (!matcher || !matcher.test(value)))
      aField.setAttribute(this.HIGHLIGHT, true);
    else
      aField.removeAttribute(this.HIGHLIGHT);
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

  swapButtons : function(aIDs)
  {
    return aIDs.replace(/button-sendToInternals/, 'button-to-be-send')
               .replace(/button-send\b/, 'button-sendToInternals')
               .replace(/button-to-be-send/, 'button-send');
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

  log('start initialization');

  top.controllers.appendController(SendToInternalsHelper);

  var toolbar = document.getElementById('composeToolbar2');
  var defaultSet = toolbar.getAttribute('defaultset');
  var currentSet = toolbar.getAttribute('currentset');
  var defaultIsInternal = Services.prefs.getBoolPref(BASE + 'defaultIsInternal');

  log('defaultSet: '+defaultSet);
  defaultSet = (defaultSet ? (defaultSet + ',') : '' ) + 'spring,button-sendToInternals';
  if (defaultIsInternal)
    defaultSet = SendToInternalsHelper.swapButtons(defaultSet);
  log('  => '+defaultSet);
  toolbar.setAttribute('defaultset', defaultSet);
  if (!Services.prefs.getBoolPref(BASE + 'initialized')) {
    Services.prefs.setBoolPref(BASE + 'initialized', true);
    log('currentSet: '+currentSet);
    if (currentSet) {
      currentSet = currentSet + ',spring,button-sendToInternals';
      if (defaultIsInternal)
        currentSet = SendToInternalsHelper.swapButtons(currentSet);
      log('  => '+currentSet);
      toolbar.setAttribute('currentset', currentSet);
    }
  }

  window.addEventListener('input', function SendToInternalsOnInput(aEvent) {
    var field = aEvent.target;
    if (field.__sendToInternals__highlightTimeout)
      clearTimeout(field.__sendToInternals__highlightTimeout);
    field.__sendToInternals__highlightTimeout = setTimeout(function() {
      log('input at '+field.id+' / '+field.value);
      if ((field.getAttribute('id') || '').indexOf('addressCol') !== 0)
        return;
      SendToInternalsHelper.updateExternalHighlight(field);
    }, 500);
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

  log('MessageComposeOfflineStateChanged aGoingOffline='+aGoingOffline);
  var button = document.getElementById('button-sendToInternals');
  if (!button) {
    log('no button');
    return;
  }

  log('button exists, update it');
  if (aGoingOffline) {
    button.label = button.getAttribute('later_label');
    button.setAttribute('tooltiptext', button.getAttribute('later_tooltiptext'))
  }
  else {
    button.label = button.getAttribute('now_label');
    button.setAttribute('tooltiptext', button.getAttribute('now_tooltiptext'))
  }
};

window.__sendToInternals__awAppendNewRow = window.awAppendNewRow;
window.awAppendNewRow = function(aSetFocus, ...aArgs) {
  var result = this.__sendToInternals__awAppendNewRow(aSetFocus, ...aArgs);
  log('awAppendNewRow');
  SendToInternalsHelper.lastField.removeAttribute(SendToInternalsHelper.HIGHLIGHT);
  return result;
};

})();
