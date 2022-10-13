import mlsClient from './mls-client';
import getResources from './mls-resources';
import getClasses from './mls-classes';
import getLookups from './mls-lookups';
import query from './mls-query';
import mlsFixDate from './mls-fix-dates';
import {batchCheckUpdateState, saveItemBatch, clearStaleItems} from './wix-sync';
import linkToImages from './mls-get-image-urls';
import Queue from './queue';
import Logger from './logger';
import stats from './statistics';
import fs from 'fs';
import {promisify} from 'util';
import uuidv4 from 'uuid/v4';
const writeFile = promisify(fs.writeFile);


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

function queueParallelism(tableConfig) {
  if (tableConfig.importImagesToWixMedia)
    return 10;
  else
    return 10;

}

async function handleBatch(itemBatch, client, siteAPI, tableConfig, logger, startIndex, force) {
  itemBatch = itemBatch.map(item => {
    return mlsFixDate(item, tableConfig.fields, tableConfig.keyField);
  });

  try {
    stats.batchStarted();
    let batchResult = await batchCheckUpdateState(itemBatch, siteAPI, tableConfig.wixCollection, logger);
    let tasks = [];
    let items = [];

    for (let i = 0; i < batchResult.length; i++) {
      let itemId = batchResult[i].id;
      let status = batchResult[i].status;
      let item = itemBatch.find(_ => _._id === itemId);
      if (status === 'need-update' || status === 'not-found' || (status === 'ok-no-images' && tableConfig.syncImages) || force) {
        if (status === 'need-update' || (status === 'ok-no-images' && tableConfig.syncImages))
          stats.addNeedUpdate();
        else
          stats.addNewItem();
        tasks.push(async function () {
          if (tableConfig.syncImages) {
            let {images, noImagesReplyCode} = await linkToImages(client, item, tableConfig.resourceID, '_id', startIndex + i,
              tableConfig.overrideGetImagesUrl, tableConfig.alternateImageObjectType, tableConfig.importImagesToWixMedia, siteAPI, checkSleep);
            await logger.auditLog(`${tableConfig.resourceID}, ${itemId}, ${status}, ${images.length}, ${noImagesReplyCode}`);
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
        await logger.auditLog(`${tableConfig.resourceID}, ${itemId}, ${status},,${batchResult[i].error}`);
        logger.error(`    ${tableConfig.resourceID} ${tableConfig.className} - ${itemId} - ${batchResult[i].error}`);
      }
      else {
        await logger.auditLog(`${tableConfig.resourceID}, ${itemId}, ${status}`);
        stats.addUnchangedItem();
      }

    }
    logger.trace(`    ${tableConfig.resourceID} ${tableConfig.className} - ${tasks.length} items to process`);
    await Queue(queueParallelism(tableConfig), tasks);
    if (items.length > 0) {
      logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - saving items`);
      let saveResult = await saveItemBatch(items, siteAPI, tableConfig.wixCollection, logger);
      logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - complete, inserted: ${saveResult.inserted}, updated: ${saveResult.updated}`);
    }
    else {
      logger.trace(`      ${tableConfig.resourceID} ${tableConfig.className} - complete, no items needed update`);
    }

    stats.batchCompleted();
  }
  catch (err) {
    logger.error('    Error: failed to complete batch', err.message);
    stats.batchFailed();
    return Promise.resolve();
  }
}

let batchNum = 0;
async function checkSleep(logger, price) {
  if (batchNum > 250) {
    await sleep(120000, logger);
    batchNum = 0;
  }
  batchNum += price || 1;
}

const defaultBatchSize = 50;


async function syncTable(retsConfig, siteAPI, tableConfig, logger, options) {
  return new Promise(function(resolve) {
    mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, async function(client) {
      logger.log();
      logger.strong('sync', tableConfig.resourceID, tableConfig.className, tableConfig.sync);
      try {
        logger.log('  query', tableConfig.resourceID, tableConfig.className);

        let mlsOffset = 0;
        let mlsCount;
        const mlsPageSize = 1000;
        const batchSize = options.batchSize || defaultBatchSize;

        do {
          let queryResult = await query(client, tableConfig, mlsPageSize, mlsOffset);
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
              await handleBatch(itemBatches[i], client, siteAPI, tableConfig, logger, mlsOffset + i*batchSize, options.force);
              logger.log(`  completed batch ${batchStartIndex}-${batchEndIndex} of ${mlsCount} - ${tableConfig.resourceID} ${tableConfig.className}`);
              await checkSleep(logger);
            }
            logger.strong(`completed all batches ${tableConfig.resourceID} ${tableConfig.className}`);
            stats.print();
          }


          mlsOffset += mlsPageSize;
        } while (mlsCount > mlsOffset);


        resolve();
      }
      catch (e) {
        logger.error(`Failed to sync ${tableConfig.resourceID} ${tableConfig.className}`, e);
        resolve();
      }
    })
  });
}

async function runClearStaleItems(tablesConfig, logger, siteAPI, options) {
  let clearedCollections = [];
  for (let i = 0; i < tablesConfig.length; i++) {
    if (tablesConfig[i].sync &&
      !clearedCollections.find(_ => _ === tablesConfig[i].wixCollection) &&
      shouldRun(tablesConfig[i].resourceID, tablesConfig[i].className, options)) {
      logger.log(`clear stale items for ${tablesConfig[i].wixCollection}`);
      await checkSleep(logger);
      clearedCollections.push(tablesConfig[i].wixCollection);
      try {
        let pendingItems = 1;
        let retryCount = 0;
        do {
          let clearResult = await clearStaleItems(siteAPI, tablesConfig[i].wixCollection, logger);
          if (typeof clearResult === 'object') {
            retryCount = 0;
            pendingItems = clearResult.staleItems;
            stats.removedItems(clearResult.itemsRemoved);
            logger.trace(`  cleared ${clearResult.itemsRemoved}, pending ${pendingItems}`);
          }
          else if (typeof clearResult === 'string' && clearResult.indexOf('Too many requests') > 0) {
            logger.trace(`  Wix Data - Too many requests. Throttling`);
            await sleep(60000, logger);
          }
          else {
            logger.trace(`  error in clear items ${JSON.stringify(clearResult)}`, typeof clearResult);
            retryCount++;
            await sleep(1000, logger);
          }
          await checkSleep(logger, 10);
        } while (pendingItems > 0 && retryCount < 4);
      }
      catch (e) {
        logger.error(`Failed to clear stale items ${tablesConfig[i].wixCollection}`, e);
      }
    }
  }
}

function shouldRun(resource, clazz, options) {
  let shouldRunByResource = (options.resources.length === 0) || !!options.resources.find(_ => _ === resource);
  let shouldRunByClass = (options.classes.length === 0) || !!options.classes.find(_ => _ === clazz);
  return shouldRunByResource && shouldRunByClass;
}

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 * @param siteAPI - baseUrl, getAPI, setAPI, purgeAPI, secret
 * @param tablesConfig - {className, resourceID, description, classTimestamp, keyField,
 *                  sync, wixCollection, wixImagesCollection}[]
 */
module.exports.syncMLS = async function syncMLS(retsConfig, siteAPI, tablesConfig, options) {
  const logger = Logger;

  if (options.sync) {
    for (let i = 0; i < tablesConfig.length; i++) {
      if (tablesConfig[i].sync && shouldRun(tablesConfig[i].resourceID, tablesConfig[i].className, options)) {
        await syncTable(retsConfig, siteAPI, tablesConfig[i], logger, options);
        await checkSleep(logger);
      }
    }
  }

  if (options.clear) {
    await runClearStaleItems(tablesConfig, logger, siteAPI, options);
  }

  logger.log('**************************************************************************');
  logger.strong('Completed the sync process');
  stats.print();
};

/**
 *
 * @param retsConfig - retsUrl, retsUser, retsPass
 */
module.exports.makeRetsConfig = async function mlsMetadata(retsConfig, outputFile) {
  await async function () {
    return new Promise(function(resolve) {
      mlsClient(retsConfig.retsUrl, retsConfig.retsUser, retsConfig.retsPass, async function (client) {
        const resources = await getResources(client);

        // doing flat map here
        let classes = Array.prototype.concat.apply([],
          await Promise.all(resources.map(resource => getClasses(client, resource))));

        // for each lookup field, lets get the lookup values
        for (let i=0; i < classes.length; i++) {
          await getLookups(client, classes[i]);
        }

        await writeFile(outputFile, JSON.stringify(classes, null, 2));
        resolve();
      });
    })
  }();
};

module.exports.makeConfig = async function makeConfig(filename) {
  await writeFile(filename,
    `{
  "loginUrl": "...ENTER HERE YOUR RETS SERVER URL...",
  "username": "...RETS SERVER USERNAME...",
  "password": "...RETS SERVER PASSWORD...",
  "secret": "${uuidv4()}",
  "siteUrl": "...WIX WEBSITE URL...",
  "sandboxLive": "sandbox",
  "batchSize": 40
}`);
};