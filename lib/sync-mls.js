const mlsClient = require('./mls-client');
const getResources = require('./mls-resources');
const getClasses = require('./mls-classes');
const query = require('./mls-query');
const mlsFixDate = require('./mls-fix-dates');
const wixSync = require('./wix-sync');
const checkUpdateState = wixSync.checkUpdateState;
const batchCheckUpdateState = wixSync.batchCheckUpdateState;
const batchCheckUpdateState2 = wixSync.batchCheckUpdateState2;
const saveItem = wixSync.saveItem;
const saveItem2 = wixSync.saveItem2;
const saveItemBatch = wixSync.saveItemBatch;
const clearStaleItems = wixSync.clearStaleItems;
const syncImages = require('./mls-import-images');
const Queue = require('./queue');
const Logger = require('./logger');

function batch(arr, batchSize) {
  let res = [];
  while(arr.length > 0) {
    res.push(arr.splice(0, batchSize))
  }
  return res;
}

function sleep(millis, logger) {
  logger.yellow(`************* throttling - waiting for ${millis} millis`);
  return new Promise(function(resolve) {
    setTimeout(resolve, millis);
  })
}

async function handleBatch(itemBatch, client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger) {
  itemBatch = itemBatch.map(item => {
    return mlsFixDate(item, tableConfig.fields, tableConfig.keyField);
  });

  try {
    let batchResult = await batchCheckUpdateState2(itemBatch, siteAPI, tableConfig.wixCollection, logger);
    let tasks = [];
    let items = [];

    for (let i = 0; i < batchResult.length; i++) {
      let itemId = batchResult[i].id;
      let status = batchResult[i].status;
      let item = itemBatch.find(_ => _._id === itemId);
      if (status !== 'ok') {
        tasks.push(async function () {
          if (tableConfig.syncImages) {
            logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - syncing images`, itemId);
            let images = await syncImages(client, item, mediaCredentials, mediaConfig, siteAPI, tableConfig.resourceID, '_id', logger);
            if (images.length > 0) {
              item.images = images;
              item.mainImage = images[0].src;
            }
          }
          items.push(item);
        });
      }
    }
    logger.trace(`    ${tableConfig.resourceID} ${tableConfig.className} - ${tasks.length} items to process`);
    await Queue(10, tasks);
    logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - saving items`);
    let saveResult = await saveItemBatch(items, siteAPI, tableConfig.wixCollection);
    logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - complete`, saveResult);

  }
  catch (err) {
    logger.error('    Error: failed to complete batch', err.message);
    return Promise.resolve();
  }

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
module.exports.syncMLS = async function syncMLS(retsConfig, mediaCredentials, mediaConfig, siteAPI, tablesConfig) {
  const logger = Logger;

  for (let i=0; i < tablesConfig.length; i++) {
    await async function () {
      return new Promise(function(resolve) {
        mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function(client) {
          const tableConfig = tablesConfig[i];
          logger.log();
          logger.strong('sync', tableConfig.resourceID, tableConfig.className, tableConfig.sync);
          if (tableConfig.sync) {
            try {
              logger.log('  query', tableConfig.resourceID, tableConfig.className);
              let itemsData = await query(client, tableConfig.resourceID, tableConfig.className, tableConfig.classTimestamp, logger);
              logger.trace('    query complete', tableConfig.resourceID, tableConfig.className, ': ', itemsData.results.length, 'items');

              if (itemsData.results.length > 0) {
                let itemBatches = batch(itemsData.results, Math.round(1000 / tableConfig.fields.length));
                let throttlingCount = 0;
                for (let i = 0; i < itemBatches.length; i++) {
                  let batchSize = itemBatches[i].length;
                  throttlingCount += batchSize;
                  logger.log(`  start batch ${i*batchSize}-${(i+1)*batchSize-1} ${tableConfig.resourceID} ${tableConfig.className}`);
                  await handleBatch(itemBatches[i], client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger);
                  logger.log(`  completed batch ${i*batchSize}-${(i+1)*batchSize-1} ${tableConfig.resourceID} ${tableConfig.className}`);
                  if (throttlingCount > 500) {
                    await sleep(120*1000, logger);
                    throttlingCount = 0;
                  }
                }
                logger.strong(`completed all batches ${tableConfig.resourceID} ${tableConfig.className}`);
              }
              resolve();
            }
            catch (e) {
              logger.error(`Failed to sync ${tableConfig.resourceID} ${tableConfig.className}`, e);
              resolve();
            }
          }
          else {
            resolve();
          }
        })
      });
    }();
    await sleep(120*1000, logger);
  }

  logger.log();
  let clearedCollections = [];
  for (let i=0; i < tablesConfig.length; i++) {
    if (tablesConfig[i].sync && !clearedCollections.find(_ => _ === tablesConfig[i].wixCollection)) {
      await sleep(120*1000, logger);
      logger.log('clear stale items for', tablesConfig[i].wixCollection);
      clearedCollections.push(tablesConfig[i].wixCollection);
      let cleared = await clearStaleItems(siteAPI, tablesConfig[i].wixCollection);
      logger.trace(`  cleared ${cleared} items`);
    }
  }
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