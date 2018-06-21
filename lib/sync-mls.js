const mlsClient = require('./mls-client');
const getResources = require('./mls-resources');
const getClasses = require('./mls-classes');
const query = require('./mls-query');
const mlsFixDate = require('./mls-fix-dates');
const wixSync = require('./wix-sync');
const checkUpdateState = wixSync.checkUpdateState;
const batchCheckUpdateState = wixSync.batchCheckUpdateState;
const saveItem = wixSync.saveItem;
const clearStaleItems = wixSync.clearStaleItems;
const syncImages = require('./mls-import-images');
const Queue = require('./queue');

function batch(arr) {
  let res = [];
  while(arr.length > 0) {
    res.push(arr.splice(0, 100))
  }
  return res;
}

async function handleBatch(itemBatch, client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger) {
  itemBatch.forEach(item => {
    mlsFixDate(item, tableConfig.fields);
  });

  let batchResult = await batchCheckUpdateState(itemBatch, siteAPI, tableConfig.wixCollection, tableConfig.keyField, tableConfig.classTimestamp, logger);

  let tasks = [];
  for (let i=0; i < batchResult.length; i++) {
    let itemId = batchResult[i].id;
    let status = batchResult[i].status;
    let item = itemBatch.find(_ => _[tableConfig.keyField] === itemId);
    if (status !== 'ok') {
//      logger.log(`    ${tableConfig.resourceID} ${tableConfig.className} - need sync`, status, itemId);
      tasks.push(async function() {
        logger.log(`      ${tableConfig.resourceID} ${tableConfig.className} - starting`, itemId);
        if (tableConfig.syncImages) {
          let images = await syncImages(client, item, mediaCredentials, mediaConfig, siteAPI, tableConfig.resourceID, tableConfig.keyField, logger);
          if (images.length > 0)
            item.images = images;
        }
        try {
          console.log(item);
          let saveResult = await saveItem(item, siteAPI, tableConfig.wixCollection, tableConfig.keyField);
          logger.log(`      ${tableConfig.resourceID} ${tableConfig.className} - complete`, itemId, saveResult);
        }
        catch (e) {
          logger.error(`      ${tableConfig.resourceID} ${tableConfig.className} - error`, itemId, e.message);
        }
      });
    }
  }

  logger.log(`    ${tableConfig.resourceID} ${tableConfig.className} - ${tasks.length} items to process`);
  let queue = Queue(10, tasks);
  return queue;
}

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 * @param mediaCredentials - appId, secret.key
 * @param mediaConfig - metasiteId, userId
 * @param siteAPI - baseUrl, getAPI, setAPI, purgeAPI, secret
 * @param tablesConfig - {className, resourceID, description, classTimestamp, keyField,
 *                  sync, wixCollection, wixImagesCollection}[]
 */
module.exports.syncMLS = function syncMLS(retsConfig, mediaCredentials, mediaConfig, siteAPI, tablesConfig) {
  const logger = console;
  mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function(client) {

    for (let i=0; i < tablesConfig.length; i++) {
      const tableConfig = tablesConfig[i];
      logger.log();
      logger.log('sync', tableConfig.resourceID, tableConfig.className, tableConfig.sync);
      if (tableConfig.sync) {
        try {
          logger.log('  query', tableConfig.resourceID, tableConfig.className);
          let itemsData = await query(client, tableConfig.resourceID, tableConfig.className, tableConfig.classTimestamp, logger);
          logger.log('    query complete', tableConfig.resourceID, tableConfig.className, ': ', itemsData.results.length, 'items');

          let itemBatches = batch(itemsData.results);
          for (let i=0; i < itemBatches.length; i++) {
            logger.log('  start batch', i, tableConfig.resourceID, tableConfig.className, ': ', itemBatches[i].length, 'items');
            await handleBatch(itemBatches[i], client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger);
            logger.log('  completed batch', i, tableConfig.resourceID, tableConfig.className, ': ', itemBatches[i].length, 'items');
          }
          logger.log('completed all batches', tableConfig.resourceID, tableConfig.className);

          await clearStaleItems(siteAPI);
        }
        catch (e) {
          logger.error(`Failed to sync ${tableConfig.resourceID} ${tableConfig.className}`, e);
        }
      }
    }
  });
};

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 */
module.exports.makeRetsConfig = function mlsMetadata(retsConfig) {
  const logger = console;
  mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function(client) {
    const resources = await getResources(client, logger);

    // doing flat map here
    let classes = Array.prototype.concat.apply([],
      await Promise.all(resources.map(resource => getClasses(client, resource, logger))));

    classes.map(aClass => {
      aClass.sync =  true;
      aClass.wixCollection = '...';
      aClass.wixImagesCollection = '...'
    });

    //require('fs').writeFileSync('./rets.config.json', JSON.stringify(classes, null, 2));
    logger.log(classes);
  });
};

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 */
module.exports.mlsMetadata = function mlsMetadata(retsConfig) {
  const logger = console;
  mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function(client) {
    const resources = await getResources(client, logger);

    // doing flat map here
    let classes = Array.prototype.concat.apply([],
      await Promise.all(resources.map(resource => getClasses(client, resource, logger))));

    require('fs').writeFileSync('./metadata.json', JSON.stringify(classes, null, 2));

//    logger.log(require('util').inspect(classes, {depth: 5, colors: true}));
  });
};