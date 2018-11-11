const mlsClient = require('./mls-client');
const getResources = require('./mls-resources');
const getClasses = require('./mls-classes');
const query = require('./mls-query');
const mlsFixDate = require('./mls-fix-dates');
const wixSync = require('./wix-sync');
const batchCheckUpdateState2 = wixSync.batchCheckUpdateState2;
const saveItemBatch = wixSync.saveItemBatch;
const clearStaleItems = wixSync.clearStaleItems;
const linkToImages = require('./mls-get-image-urls');
const syncImages = require('./mls-import-images');
const Queue = require('./queue');
const Logger = require('./logger');
const stats = require('./statistics');

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

async function handleBatch(itemBatch, client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger, startIndex) {
  itemBatch = itemBatch.map(item => {
    return mlsFixDate(item, tableConfig.fields, tableConfig.keyField);
  });

  try {
    stats.batchStarted();
    let batchResult = await batchCheckUpdateState2(itemBatch, siteAPI, tableConfig.wixCollection, logger);
    let tasks = [];
    let items = [];

    for (let i = 0; i < batchResult.length; i++) {
      let itemId = batchResult[i].id;
      let status = batchResult[i].status;
      let item = itemBatch.find(_ => _._id === itemId);
      if (status === 'need-update' || status === 'not-found') { 
        if (status === 'need-update')
          stats.addNeedUpdate();
        else
          stats.addNewItem();
        tasks.push(async function () {
          if (tableConfig.syncImages) {
            // logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - syncing images`, itemId);
            let images;
            if (mediaConfig.uploadOrLinkImages === 'link')
              images = await linkToImages(client, item, tableConfig.resourceID, '_id', logger, startIndex + i);
            else
              images = await syncImages(client, item, mediaCredentials, mediaConfig, tableConfig.resourceID, '_id', logger, startIndex + i);
            if (images.length > 0) {
              item.images = images;
              item.mainImage = images[0].src;
            }
          }
          items.push(item);
        });
      }
      else if (status === 'error') {
        stats.errorSyncingItem();
        logger.error(`    ${tableConfig.resourceID} ${tableConfig.className} - ${itemId} - ${batchResult[i].error}`);
      }
      else
        stats.addUnchangedItem();

    }
    logger.trace(`    ${tableConfig.resourceID} ${tableConfig.className} - ${tasks.length} items to process`);
    await Queue(10, tasks);
    logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - saving items`);
    let saveResult = await saveItemBatch(items, siteAPI, tableConfig.wixCollection);
    logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - complete`, saveResult);

    stats.batchCompleted();
  }
  catch (err) {
    logger.error('    Error: failed to complete batch', err.message);
    stats.batchFailed();
    return Promise.resolve();
  }

}

const batchSize = 50;
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

  let batchNum = 0;
  async function checkSleep() {
    if (batchNum > 250) {
      await sleep(120000, logger);
      batchNum = 0;
    }
    batchNum++;
  }

  for (let i=0; i < tablesConfig.length; i++) {
    if (tablesConfig[i].sync) {
      await async function () {
        return new Promise(function(resolve) {
          mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function(client) {
            const tableConfig = tablesConfig[i];
            logger.log();
            logger.strong('sync', tableConfig.resourceID, tableConfig.className, tableConfig.sync);
            try {
              logger.log('  query', tableConfig.resourceID, tableConfig.className);

              let mlsOffset = 0;
              let mlsCount;
              const mlsPageSize = 10000;


              do {
                let queryResult = await query(client, tableConfig.resourceID, tableConfig.className, tableConfig.classTimestamp,
                  tableConfig.keyField, logger, mlsPageSize, mlsOffset);
                logger.trace(`    query page (${mlsPageSize}/${mlsOffset}) total: ${queryResult.count}`);
                if (!mlsCount) {
                  mlsCount = queryResult.count;
                }

                if (queryResult.results.length > 0) {
                  let itemBatches = batch(queryResult.results, batchSize);
                  for (let i = 0; i < itemBatches.length; i++) {
                    let batchStartIndex = mlsOffset+i*batchSize;
                    let batchEndIndex = mlsOffset+(i+1)*batchSize-1;
                    logger.log(`  start batch ${batchStartIndex}-${batchEndIndex} of ${mlsCount} - ${tableConfig.resourceID} ${tableConfig.className}`);
                    await handleBatch(itemBatches[i], client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger, i*batchSize);
                    logger.log(`  completed batch ${batchStartIndex}-${batchEndIndex} of ${mlsCount} - ${tableConfig.resourceID} ${tableConfig.className}`);
                    await checkSleep();
                  }
                  logger.strong(`completed all batches ${tableConfig.resourceID} ${tableConfig.className}`);
                  stats.print();
                }


                mlsOffset += mlsPageSize;
              } while (mlsCount > mlsOffset);


              //   let itemsData = await query(client, tableConfig.resourceID, tableConfig.className, tableConfig.classTimestamp, tableConfig.keyField, logger);
              // logger.trace('    query complete', tableConfig.resourceID, tableConfig.className, ': ', itemsData.results.length, 'items');
              //
              // if (itemsData.results.length > 0) {
              //   let itemBatches = batch(itemsData.results, batchSize);
              //   for (let i = 0; i < itemBatches.length; i++) {
              //     logger.log(`  start batch ${i*batchSize}-${(i+1)*batchSize-1} ${tableConfig.resourceID} ${tableConfig.className}`);
              //     await handleBatch(itemBatches[i], client, mediaCredentials, mediaConfig, siteAPI, tableConfig, logger, i*batchSize);
              //     logger.log(`  completed batch ${i*batchSize}-${(i+1)*batchSize-1} ${tableConfig.resourceID} ${tableConfig.className}`);
              //     await checkSleep();
              //   }
              //   logger.strong(`completed all batches ${tableConfig.resourceID} ${tableConfig.className}`);
              //   stats.print();
              // }
              resolve();
            }
            catch (e) {
              logger.error(`Failed to sync ${tableConfig.resourceID} ${tableConfig.className}`, e);
              resolve();
            }
          })
        });
      }();
      await checkSleep();
    }
  }

  logger.log();
  let clearedCollections = [];
  for (let i=0; i < tablesConfig.length; i++) {
    if (tablesConfig[i].sync && !clearedCollections.find(_ => _ === tablesConfig[i].wixCollection)) {
      await sleep(120*1000, logger);
      logger.log('clear stale items for', tablesConfig[i].wixCollection);
      clearedCollections.push(tablesConfig[i].wixCollection);
      try {
        let cleared = await clearStaleItems(siteAPI, tablesConfig[i].wixCollection);
        logger.trace(`  cleared ${cleared} items`);
      }
      catch(e) {
        logger.error(`Failed to clear stale items ${tablesConfig[i].wixCollection}`, e);
      }
    }
  }

  stats.print();
};

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 */
module.exports.makeRetsConfig = async function mlsMetadata(retsConfig, outputFile) {
  const logger = console;
  await async function () {
    return new Promise(function(resolve) {
      mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, logger, async function (client) {
        const resources = await getResources(client, logger);

        // doing flat map here
        let classes = Array.prototype.concat.apply([],
          await Promise.all(resources.map(resource => getClasses(client, resource, logger))));

        classes.map(aClass => {
          aClass.sync = true;
          aClass.wixCollection = '...';
        });

        require('fs').writeFileSync(outputFile, JSON.stringify(classes, null, 2));
        logger.log(classes);
        resolve();
      });
    })
  }();
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