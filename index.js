const rets = require('rets-client');
const fs = require('fs');
const util = require('util');
const clientSettings = require("./josh-credentials").clientSettings;
const readAllTables = require('./read-all-tables');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const photoSourceId = '12345'; // <--- dummy example ID!  this will usually be a MLS number / listing id

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

async function getResources(client) {
  let data = await client.metadata.getResources();

  console.log("======================================");
  console.log("========  Resources Metadata  ========");
  console.log("======================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  log(data.headerInfo);
  console.log('   ~~~~~~ Resources Metadata ~~~~~');
  log(data.results[0].info);
  for (var dataItem = 0; dataItem < data.results[0].metadata.length; dataItem++) {
    console.log("   -------- Resource " + dataItem + " --------");
    log(data.results[0].metadata[dataItem], {fields: ['ResourceID', 'StandardName', 'VisibleName', 'ObjectVersion']});
    // outputFields(data.results[0].metadata[dataItem], {fields: ['ResourceID', 'StandardName', 'VisibleName', 'ObjectVersion']});
  }
}

async function getClass(client, resource) {
  let data = await client.metadata.getClass(resource);
  console.log("===========================================================");
  console.log(`========  Class Metadata (from ${resource} Resource)  ========`);
  console.log("===========================================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  log(data.headerInfo);
  console.log('   ~~~~~~~~ Class Metadata ~~~~~~~');
  log(data.results[0].info);
  for (let classItem = 0; classItem < data.results[0].metadata.length; classItem++) {
    console.log("   -------- Table " + classItem + " --------");
    log(data.results[0].metadata[classItem], {fields: ['ClassName', 'StandardName', 'VisibleName', 'TableVersion']});
  }
}

async function getObject(client, resource) {
  let data = await client.metadata.getObject(resource);
  console.log("===========================================================");
  console.log(`========  Object Metadata (from ${resource} Resource)  ========`);
  console.log("===========================================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  log(data.headerInfo);
  console.log('   ~~~~~~~~ Object Metadata ~~~~~~~');
  if (data.entriesReceived > 0) {
    log(data.results[0].info);
    for (let classItem = 0; classItem < data.results[0].metadata.length; classItem++) {
      console.log("   -------- Table " + classItem + " --------");
      log(data.results[0].metadata[classItem], {fields: ['ClassName', 'StandardName', 'VisibleName', 'TableVersion']});
    }
  }
  else
    console.log('   NO DATA');

}

async function getTableFieldCount(client, resource, className, classId) {
  let data = await client.metadata.getTable(resource, classId);
  console.log(`${resource} ${className} - ${classId}: ${data.results[0].metadata.length} fields`);
}

async function getTableFields(client, resource, className, classId) {
  console.log('getTable', resource, classId);
  let data = await client.metadata.getTable(resource, classId);
  console.log(`${resource} ${className} - ${classId}: ${data.results[0].metadata.length} fields`);
  console.log("==============================================");
  console.log(`========  ${resource} ${className} Table Metadata  ========`);
  console.log("===============================================");
  console.log('   ~~~~~~~~~ Header Info ~~~~~~~~~');
  log(data.headerInfo);
  console.log('   ~~~~~~~~ Table Metadata ~~~~~~~');
  log(data.results[0].info);
  console.log('MetadataEntryID, SystemName, ShortName, LongName, DataType');
  data.results[0].metadata.forEach(field => {
    console.log(`${field.MetadataEntryID}, ${field.SystemName}, ${field.ShortName}, ${field.LongName}, ${field.DataType}`);
  });
  let fields = data.results[0].metadata.map(field => {
    return {
      id: field.SystemName,
      title: field.LongName
    }
  });
  return fields;
}

async function readTable(client, resource, className, query, fields) {
  let itemsData = await client.search.query(resource, className, query, {limit:10000, offset:0});

  const csvWriter = createCsvWriter({
    path: `tmp/${resource}-${className}.csv`,
    header: fields
  });

  await csvWriter.writeRecords(itemsData.results);

  // itemsData.results.forEach(item => {
  //   console.log(`${item.L_ListingID}, ${item.L_State}, ${item.L_City}, ${item.L_AddressStreet}, ${item.L_AddressNumber}, ${item.L_AskingPrice}, ${item.L_PictureCount}`)
  //    if (item.L_PictureCount === 20)
  //      log(item);
  // });
  console.log(itemsData.results.length);
}

async function getPhotosForResource(client, resourceId) {    // get photos
  let photoResults = await client.objects.getAllObjects("Property", "Photo", resourceId, {alwaysGroupObjects: true, ObjectData: '*'})
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
        "tmp/photo" + (i + 1) + "." + photoResults.objects[i].headerInfo.contentType.match(/\w+\/(\w+)/i)[1],
        photoResults.objects[i].data);
    }
  }
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

  await readAllTables(client);

  // get resources
  // await getResources(client);

  // get class metadata
  // await getClass(client, "Property");
  // await getClass(client, "ActiveAgent");
  // await getClass(client, "OpenHouse");

  // await getObject(client, "Property");
  // await getObject(client, "ActiveAgent");
  // await getObject(client, "OpenHouse");

  // await getTableFieldCount(client, "Property", "Residential Detached", "RD_1");
  // await getTableFieldCount(client, "Property", "Residential Attached", "RA_2");
  // await getTableFieldCount(client, "Property", "Multifamily", "MF_3");
  // await getTableFieldCount(client, "Property", "Land", "LD_4");
  // await getTableFieldCount(client, "ActiveAgent", "Active Agent", "ActiveAgent");
  // await getTableFieldCount(client, "OpenHouse", "Residential Detached", "RD_1");
  // await getTableFieldCount(client, "OpenHouse", "Residential Attached", "RA_2");
  // await getTableFieldCount(client, "OpenHouse", "Multifamily", "MF_3");
  // await getTableFieldCount(client, "OpenHouse", "Land", "LD_4");

  // let fields = await getTableFields(client, "Property", "Residential Detached", "RD_1");
  // await getTableFields(client, "Property", "Residential Attached", "RA_2");
  // await getTableFields(client, "Property", "Multifamily", "MF_3");
  // await getTableFields(client, "Property", "Land", "LD_4");
  // await getTableFields(client, "ActiveAgent", "Active Agent", "ActiveAgent");
  // await getTableFields(client, "OpenHouse", "Residential Detached", "RD_1");
  // await getTableFields(client, "OpenHouse", "Residential Attached", "RA_2");
  // await getTableFields(client, "OpenHouse", "Multifamily", "MF_3");
  // await getTableFields(client, "OpenHouse", "Land", "LD_4");

  // await readTable(client, "Property", "RD_1", "(L_UpdateDate=2010-01-01+)", fields);
  // await readTable(client, "Property", "RA_2", "(L_UpdateDate=2010-01-01+)");

  // await getPhotosForResource(client, '262188347')

}).catch(function (errorInfo) {
  var error = errorInfo? (errorInfo.error || errorInfo): 'unknown';
  console.log("   ERROR: issue encountered:");
  outputFields(error);
  console.log('   '+(error.stack||error).replace(/\n/g, '\n   '));
});
