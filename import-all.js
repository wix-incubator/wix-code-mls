const rets = require('rets-client');
const util = require('util');
const clientSettings = require("./josh-credentials").clientSettings;
const readAllTables = require('./read-all-tables').readAll;
const listTables = require('./read-all-tables').listTables;

function outputFields(obj, opts) {
  if (!obj) {
    console.log("      "+JSON.stringify(obj))
  } else {
    if (!opts) opts = {};

    var excludeFields;
    var loopFields;
    if (opts.exclude) {
      excludeFields = opts.exclude;
      loopFields = Object.keys(obj);
    } else if (opts.fields) {
      loopFields = opts.fields;
      excludeFields = [];
    } else {
      loopFields = Object.keys(obj);
      excludeFields = [];
    }
    for (var i = 0; i < loopFields.length; i++) {
      if (excludeFields.indexOf(loopFields[i]) != -1) {
        continue;
      }
      if (typeof(obj[loopFields[i]]) == 'object') {
        console.log("      " + loopFields[i] + ": " + JSON.stringify(obj[loopFields[i]], null, 2).replace(/\n/g, '\n      '));
      } else {
        console.log("      " + loopFields[i] + ": " + JSON.stringify(obj[loopFields[i]]));
      }
    }
  }
  console.log("");
}

function log(obj) {
  console.log(util.inspect(obj, {colors: true, depth: 5}));
}

console.log("trying to connect...");
// establish connection to RETS server which auto-logs out when we're done
rets.getAutoLogoutClient(clientSettings, async function (client) {
  console.log("===================================");
  console.log("========  System Metadata  ========");
  console.log("===================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  log(client.loginHeaderInfo);
  console.log('   ~~~~~~~~~ System Data ~~~~~~~~~');
  log(client.systemData);

  //get resources metadata

  await listTables(client);


}).catch(function (errorInfo) {
  let error = errorInfo? (errorInfo.error || errorInfo): 'unknown';
  console.log("   ERROR: issue encountered:");
  outputFields(error);
  console.log('   '+(error.stack||error).replace(/\n/g, '\n   '));
});
