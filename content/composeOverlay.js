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
    if (internalDomains.length === 0) {
      alert('no domain config');
      return false;
    }

    var externals = this.getAllRecipients().filter(function(aAddress) {
      var domain = aAddress.address.split('@')[1];
      return internalDomains.indexOf(domain) < 0;
    }, this);
    if (externals.length !== 0) {
      this.highlightExternals(externals);
      alert('no internal address');
      return false;
    }
    
    return true;
  },

  highlightExternals: function(aAddresses)
  {
  },

  getAllRecipients: function() {
    var msgCompFields = gMsgCompose.compFields;
    Recipients2CompFields(msgCompFields);
    gMsgCompose.expandMailingLists();
    return this.splitRecipients(msgCompFields.to, 'To')
    		.concat(this.splitRecipients(msgCompFields.cc, 'Cc'))
            .concat(this.splitRecipients(msgCompFields.bcc, 'Bcc'));
  },

  splitRecipients: function(aAddressesSource, aType){
    var addresses = {};
    var names = {};
    var fullNames = {};
    var numAddresses = MimeHeaderParser.parseHeadersWithArray(
                         aAddressesSource, addresses, names, fullNames);
    var recipients = [];
    for (let i = 0; i < numAddresses; i++) {
      let address = addresses.value[i];
      let domain = address.split('@')[1];
      if (this.ignoredDomains.indexOf(domain) > -1)
        continue;
      recipients.push({
        address:  address,
        name:     names.value[i],
        fullName: fullNames.value[i],
        type:     aType
      });
    }
    return recipients;
  }
};
window.SendToInternalsHelper = SendToInternalsHelper;

window.addEventListener('DOMContentLoaded', function SendToInternalsOnLoad(aEvent) {
  window.removeEventListener(aEvent.type, SendToInternalsOnLoad, false);

  var toolbar = document.getElementById('composeToolbar2');
  var defaultSet = toolbar.getAttribute('defaultset');
  var currentSet = toolbar.getAttribute('currentset');

  defaultSet = (defaultSet ? (defaultSet + ',') : '' ) + 'spring,button-sendToInternals';
  toolbar.setAttribute('defaultset', defaultSet);
  if (!Services.prefs.getBoolPref(BASE + 'initialized')) {
    Services.prefs.setBoolPref(BASE + 'initialized', true);
    currentSet = (currentSet ? (currentSet + ',') : '' ) + 'spring,button-sendToInternals';
    toolbar.setAttribute('currentset', currentSet);
  }
}, false);

})();
