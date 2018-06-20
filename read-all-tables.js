const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

async function getResources(client) {
  console.log('getResources');
  let data = await client.metadata.getResources();

  return data.results[0].metadata.map(_ => {
    return {resourceID: _.ResourceID, keyField: _.KeyField};
  });
}

async function getClasses(client, resource) {
  console.log('getClass', resource.resourceID);
  let data = await client.metadata.getClass(resource.resourceID);

  return data.results[0].metadata.map(_ => {
    return {
      className: _.ClassName,
      description: _.Description,
      classTimestamp: _.ClassTimeStamp,
      resourceID: resource.resourceID,
      keyField: resource.keyField
    }
  })
}

async function readTable(client, aClass) {
  console.log('getTable', aClass.resourceID, aClass.className);
  let data = await client.metadata.getTable(aClass.resourceID, aClass.className);
  let fields = data.results[0].metadata.map(field => {
    return {
      id: field.SystemName,
      title: field.LongName
    }
  });

  console.log('query', aClass.resourceID, aClass.className, `(${aClass.classTimestamp}=2010-01-01+)`);
  try {
    let itemsData = await client.search.query(aClass.resourceID, aClass.className, `(${aClass.classTimestamp}=2010-01-01+)`,
      {limit:20000, offset:0});

    console.log(`found ${itemsData.results.length} records`);

    const csvWriter = createCsvWriter({
      path: `tmp/${aClass.resourceID}-${aClass.description}.csv`,
      header: fields
    });

    await csvWriter.writeRecords(itemsData.results);
    for (let i=0; i < itemsData.results.length; i++) {
      await getPhotosForResource(client, aClass, itemsData.results[i][aClass.keyField]);
    }
  }
  catch (e) {
    if (e.replyCode === '20201')
      console.log('no records found');
    else
      console.log(JSON.stringify(e));
  }
}

async function getPhotosForResource(client, aClass, resourceKey) {    // get photos
  console.log('getPhotosForResource', aClass.resourceID, 'Photo', resourceKey);
  let photoResults = await client.objects.getAllObjects(aClass.resourceID, 'Photo', resourceKey, {alwaysGroupObjects: true, ObjectData: '*'});
//  console.log(require('util').inspect(photoResults, {colors: true, depth: 5}));
  for (let i = 0; i < photoResults.objects.length; i++) {
    if (photoResults.objects[i].type === 'headerInfo')
      ;
    else if (photoResults.objects[i].error) {
      console.log(`  Error reading ${aClass.resourceID} photos for key ${resourceKey}: ${photoResults.objects[i].error}`);
    }
    else {
      console.log(`  Photo ${aClass.resourceID}-${resourceKey}-${i + 1}.${photoResults.objects[i].headerInfo.contentType.match(/\w+\/(\w+)/i)[1]}`);
      fs.writeFileSync(
        `tmp/${aClass.resourceID}-${resourceKey}-${i + 1}.${photoResults.objects[i].headerInfo.contentType.match(/\w+\/(\w+)/i)[1]}`,
        photoResults.objects[i].data);
    }
  }
}


module.exports.readAll = async function(client) {
  let resources = await getResources(client);

  // doing flat map here
  let classes = Array.prototype.concat.apply([],
    await Promise.all(resources.map(resource => getClasses(client, resource))));

  for (let i=0; i < classes.length; i++) {
    await readTable(client, classes[i]);
  }
};

module.exports.listTables = async function(client) {
  let resources = await getResources(client);

  // doing flat map here
  let classes = Array.prototype.concat.apply([],
    await Promise.all(resources.map(resource => getClasses(client, resource))));

  for (let i=0; i < classes.length; i++) {
    console.log('table', `"${classes[i].resourceID} ${classes[i].description}"`, classes[i]);
  }
};