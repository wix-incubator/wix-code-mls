var rets = require('rets-client');
var fs = require('fs');
var photoSourceId = '12345'; // <--- dummy example ID!  this will usually be a MLS number / listing id

import {clientSettings} from "./josh-credentials";

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


console.log("trying to connect...");
// establish connection to RETS server which auto-logs out when we're done
rets.getAutoLogoutClient(clientSettings, function (client) {
  console.log("===================================");
  console.log("========  System Metadata  ========");
  console.log("===================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  outputFields(client.loginHeaderInfo);
  console.log('   ~~~~~~~~~ System Data ~~~~~~~~~');
  outputFields(client.systemData);

  //get resources metadata
  return client.metadata.getResources()
    .then(function (data) {
      console.log("======================================");
      console.log("========  Resources Metadata  ========");
      console.log("======================================");
      console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
      outputFields(data.headerInfo);
      console.log('   ~~~~~~ Resources Metadata ~~~~~');
      outputFields(data.results[0].info);
      for (var dataItem = 0; dataItem < data.results[0].metadata.length; dataItem++) {
        console.log("   -------- Resource " + dataItem + " --------");
        outputFields(data.results[0].metadata[dataItem], {fields: ['ResourceID', 'StandardName', 'VisibleName', 'ObjectVersion']});
      }
    }).then(function () {

      //get class metadata
      return client.metadata.getClass("Property");
    }).then(function (data) {
      console.log("===========================================================");
      console.log("========  Class Metadata (from Property Resource)  ========");
      console.log("===========================================================");
      console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
      outputFields(data.headerInfo);
      console.log('   ~~~~~~~~ Class Metadata ~~~~~~~');
      outputFields(data.results[0].info);
      for (var classItem = 0; classItem < data.results[0].metadata.length; classItem++) {
        console.log("   -------- Table " + classItem + " --------");
        outputFields(data.results[0].metadata[classItem], {fields: ['ClassName', 'StandardName', 'VisibleName', 'TableVersion']});
      }
    }).then(function () {

      //get field data for open houses
      return client.metadata.getTable("Property", "RD_1");
    }).then(function (data) {
      console.log("==============================================");
      console.log("========  Residential Table Metadata  ========");
      console.log("===============================================");
      console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
      outputFields(data.headerInfo);
      console.log('   ~~~~~~~~ Table Metadata ~~~~~~~');
      outputFields(data.results[0].info);
      for (var tableItem = 0; tableItem < data.results[0].metadata.length; tableItem++) {
        console.log("   -------- Field " + tableItem + " --------");
        outputFields(data.results[0].metadata[tableItem], {fields: ['MetadataEntryID', 'SystemName', 'ShortName', 'LongName', 'DataType']});
      }
      return data.results[0].metadata
    }).then(function (fieldsData) {
      var plucked = [];
      for (var fieldItem = 0; fieldItem < fieldsData.length; fieldItem++) {
        plucked.push(fieldsData[fieldItem].SystemName);
      }
      return plucked;
    }).then(function (fields) {

      //perform a query using DMQL2 -- pass resource, class, and query, and options
      return client.search.query("Property", "RD_1", "(LM_Int2_3=0)", {limit:100, offset:10})
        .then(function (searchData) {
          console.log("=============================================");
          console.log("========  Residential Query Results  ========");
          console.log("=============================================");
          console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
          outputFields(searchData.headerInfo);
          console.log('   ~~~~~~~~~~ Query Info ~~~~~~~~~');
          outputFields(searchData, {exclude: ['results','headerInfo']});
          //iterate through search results
          for (var dataItem = 0; dataItem < searchData.results.length; dataItem++) {
            console.log("   -------- Result " + dataItem + " --------");
            outputFields(searchData.results[dataItem], {fields: fields});
          }
          if (searchData.maxRowsExceeded) {
            console.log("   -------- More rows available!");
          }
        });
    }).then(function () {

      // get photos
      return client.objects.getAllObjects("Property", "LargePhoto", photoSourceId, {alwaysGroupObjects: true, ObjectData: '*'})
    }).then(function (photoResults) {
      console.log("=================================");
      console.log("========  Photo Results  ========");
      console.log("=================================");
      console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
      outputFields(photoResults.headerInfo);
      for (var i = 0; i < photoResults.objects.length; i++) {
        console.log("   -------- Photo " + (i + 1) + " --------");
        if (photoResults.objects[i].error) {
          console.log("      Error: " + photoResults.objects[i].error);
        } else {
          outputFields(photoResults.objects[i].headerInfo);
          fs.writeFileSync(
            "/tmp/photo" + (i + 1) + "." + photoResults.objects[i].headerInfo.contentType.match(/\w+\/(\w+)/i)[1],
            photoResults.objects[i].data);
        }
      }
    });

}).catch(function (errorInfo) {
  var error = errorInfo? (errorInfo.error || errorInfo): 'unknown';
  console.log("   ERROR: issue encountered:");
  outputFields(error);
  console.log('   '+(error.stack||error).replace(/\n/g, '\n   '));
});
