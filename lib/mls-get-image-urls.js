import logger from './logger';
import path from 'path';

export default async function getImageUrls(client, item, resourceID, keyField, itemIndex, overrideGetImagesUrl) {
  if (overrideGetImagesUrl)
    return runOverrideGetImageUrl(client, item, resourceID, keyField, itemIndex, overrideGetImagesUrl);
  else
    return defaultGetImageUrls(client, item, resourceID, keyField, itemIndex);

}

async function runOverrideGetImageUrl(client, item, resourceID, keyField, itemIndex, overrideGetImagesUrl) {
  let modulePath = require.main.filename;
  let moduleDir = path.dirname(modulePath);
  let hookModule = path.join(moduleDir, overrideGetImagesUrl);
  let hook = require(hookModule);
  logger.log('      override getImageUrls', resourceID, 'item', itemIndex);

  try {
    let imageUrls = await hook(client, item, resourceID, keyField, itemIndex, logger);

    logger.trace('        getImageUrls - has ',imageUrls.length,' image', resourceID, item[keyField]);

    let imagesAsObjects = imageUrls.map(url => {
      return {
        type: 'image',
        src: url
      }
    });

    return {images: imagesAsObjects, noImagesReplyCode:""};

  }
  catch (err) {
    logger.error(`        Resource ${resourceID} item ${itemIndex} - failed to run overrideGetImagesUrl hook\n                  ${err.message}`);
    return {images: [], noImagesReplyCode:'failed to run overrideGetImagesUrl hook'};
  }
}

async function defaultGetImageUrls(client, item, resourceID, keyField, itemIndex) {
  let resourceKey = item[keyField];
  logger.log('      getImageUrls', resourceID, 'Photo', resourceKey, 'item', itemIndex);
  let photoResults;
  try {
    photoResults = await client.objects.getAllObjects(resourceID, 'Photo', [resourceKey], {
      alwaysGroupObjects: true,
      ObjectData: '*',
      Location: 1
    });
  }
  catch (e) {
    if (e.name === 'RetsReplyError' && e.replyTag === 'INVALID_RESOURCE' && e.retsMethod === 'getObject') {
      logger.warn(`        Resource ${resourceID} does not have Photos. \n                To prevent this message and speed up sync, mark in the schema file "syncImages": false`);
      return [];
    }
    else {
      throw e;
    }
  }
  let images = [];
  let noImagesReplyCode = '';
  for (let i = 0; i < photoResults.objects.length; i++) {
    if (photoResults.objects[i].type === 'headerInfo') {
      // ignore the header
    }
    else if (photoResults.objects[i].error) {
      if (photoResults.objects[i].error.replyCode === '20403') {
        // no objects found
        noImagesReplyCode = 'MLS server reports no object found - status 20403';
        logger.trace(`        getImageUrls - no photos found for ${resourceID} - ${resourceKey}`);
      }
      else
        logger.warn(`        getImageUrls - Error reading ${resourceID} photos for key ${resourceKey}: ${photoResults.objects[i].error}`);
    }
    else if (photoResults.objects[i].headerInfo.location && photoResults.objects[i].headerInfo.contentType) {
      // a photo
      let url = photoResults.objects[i].headerInfo.location;
      if (url.indexOf("//") === 0)
        url = "https:" + url;
      if (url.indexOf("http://") === 0)
        url = url.replace("http", "https");
      images.push({
        type: 'image',
        src: url
      });
    }
  }
  logger.trace('        getImageUrls - has ',images.length,' image', resourceID, resourceKey);

  return {images, noImagesReplyCode};
};

