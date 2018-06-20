const mlsClient = require('./mls-client');
const getResources = require('./mls-resources');
const getClasses = require('./mls-classes');
const query = require('./mls-query');
const mlsFixDate = require('./mls-fix-dates');
const wixSync = require('./wix-sync');
const checkUpdateState = wixSync.checkUpdateState;
const saveItem = wixSync.saveItem;
const clearStaleItems = wixSync.clearStaleItems;
const syncImages = require('./mls-import-images');
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
      if (tableConfig.sync) {
        try {
          logger.log('query', tableConfig.resourceID, tableConfig.className);
          let itemsData = await query(client, tableConfig.resourceID, tableConfig.className, tableConfig.classTimestamp, logger);
          logger.log('query complete', tableConfig.resourceID, tableConfig.className, ': ', itemsData.results.length, 'items');

          for (let i = 0; i < itemsData.results.length; i++) {
            const item = itemsData.results[i];
            mlsFixDate(item, tableConfig.fields);
            let updateState = await checkUpdateState(item, siteAPI, tableConfig.wixCollection, tableConfig.keyField, tableConfig.classTimestamp, logger);
            logger.log();
            logger.log(tableConfig.resourceID, tableConfig.className, 'index: ', i, 'sync status:', updateState);
            if (updateState !== 'ok') {
              if (tableConfig.syncImages) {
                let images = await syncImages(client, item, mediaCredentials, mediaConfig, siteAPI, tableConfig.resourceID, tableConfig.keyField, logger);
                if (images.length > 0)
                  item.images = images;
              }
              let saveResult = await saveItem(item, siteAPI, tableConfig.wixCollection, tableConfig.keyField);
              logger.log(`  ${tableConfig.resourceID} ${tableConfig.className} - complete`, saveResult);
            }
          }
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