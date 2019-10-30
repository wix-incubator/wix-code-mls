import logger from './logger';
import path from 'path';
import {uploadImages} from './wix-sync';

export default async function getImageUrls(client, item, resourceID, keyField, itemIndex,
                                           overrideGetImagesUrl, alternateImageObjectType, importImagesToWixMedia, siteAPI, checkSleep) {
  if (overrideGetImagesUrl)
    return runOverrideGetImageUrl(client, item, resourceID, keyField, itemIndex, overrideGetImagesUrl);
  else if (importImagesToWixMedia)
    return importImages(client, item, resourceID, keyField, itemIndex, siteAPI, checkSleep, alternateImageObjectType);
  else
    return defaultGetImageUrls(client, item, resourceID, keyField, itemIndex, alternateImageObjectType);


}

async function runOverrideGetImageUrl(client, item, resourceID, keyField, itemIndex, overrideGetImagesUrl) {
  let modulePath = require.main.filename;
  let moduleDir = path.dirname(modulePath);
  let hookModule = path.join(moduleDir, overrideGetImagesUrl);
  let hook = require(hookModule);
  logger.log('      override getImageUrls', resourceID, 'item', itemIndex);

  try {
    let imageUrls = await hook(client, item, resourceID, keyField, itemIndex, logger);

    logger.trace('        getImageUrls - has ',(imageUrls.length===0)?'no':imageUrls.length,' image', resourceID, item[keyField]);

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

async function importImages(client, item, resourceID, keyField, itemIndex, siteAPI, checkSleep, alternateImageObjectType) {
  let resourceKey = item[keyField];
  let objectType = (!!alternateImageObjectType)?alternateImageObjectType:'Photo';
  logger.log(`      importImages - ${resourceID} - ${resourceKey} - objectType: ${objectType} item ${itemIndex}`);
  let photoResults;
  let noImagesReplyCode = '';
  try {
    photoResults = await client.objects.getAllObjects(resourceID, objectType, [resourceKey], {
      alwaysGroupObjects: true,
      ObjectData: '*',
    });
  }
  catch (e) {
    if (e.name === 'RetsReplyError' && e.replyTag === 'INVALID_RESOURCE' && e.retsMethod === 'getObject') {
      logger.warn(`        Resource ${resourceID} does not have Photos. \n                To prevent this message and speed up sync, mark in the schema file "syncImages": false`);
      noImagesReplyCode = 'MLS server reports no objects supported for resource - INVALID_RESOURCE error';
      return {images: [], noImagesReplyCode};
    }
    else if (e.name === 'RetsReplyError' && e.replyTag === 'NO_OBJECT_FOUND' && e.retsMethod === 'getObject') {
      logger.trace(`        importImages - no photos found for ${resourceID} - ${resourceKey}`);
      noImagesReplyCode = 'MLS server reports no object found - NO_OBJECT_FOUND error ';
      return {images: [], noImagesReplyCode};
    }
    else {
      throw e;
    }
  }

  let imagesData = photoResults.objects.filter(obj => {
    if (obj.type === 'headerInfo') {
      return false;
    }
    else if (obj.error) {
      if (obj.error.replyCode === '20403') {
        // no objects found
        noImagesReplyCode = 'MLS server reports no object found - status 20403';
        logger.trace(`        importImages - no photos found for ${resourceID} - ${resourceKey}`);
      }
      else
        logger.warn(`        importImages - Error reading ${resourceID} photos for key ${resourceKey}: ${obj.error}`);
      return false;
    }
    else
      return true;
  }).map(obj => {
    return {imageData: obj.data, mimeType: obj.headerInfo.contentType};
  });

  await checkSleep(logger);
  let uploadedImages = await uploadImages(imagesData, resourceID, resourceKey, siteAPI);

  let images = uploadedImages.map(url => {
    return {
      type: 'image',
      src: url
    }
  });

  if (images.length === 0)
    logger.trace(`        importImages - ${resourceID} - ${resourceKey} has no images`);
  else
    logger.trace(`        importImages - ${resourceID} - ${resourceKey} completed importing ${images.length} images`);

  return {images, noImagesReplyCode};

}

async function defaultGetImageUrls(client, item, resourceID, keyField, itemIndex, alternateImageObjectType) {
  let resourceKey = item[keyField];
  let objectType = (!!alternateImageObjectType)?alternateImageObjectType:'Photo';
  logger.log('      getImageUrls', resourceID, objectType, resourceKey, 'item', itemIndex);
  let photoResults;
  let images = [];
  let noImagesReplyCode = '';
  try {
    photoResults = await client.objects.getAllObjects(resourceID, objectType, [resourceKey], {
      alwaysGroupObjects: true,
      ObjectData: '*',
      Location: 1
    });
  }
  catch (e) {
    if (e.name === 'RetsReplyError' && e.replyTag === 'INVALID_RESOURCE' && e.retsMethod === 'getObject') {
      logger.warn(`        Resource ${resourceID} does not have Photos. \n                To prevent this message and speed up sync, mark in the schema file "syncImages": false`);
      noImagesReplyCode = 'MLS server reports no objects supported for resource - INVALID_RESOURCE error';
      return {images, noImagesReplyCode};
    }
    else {
      throw e;
    }
  }
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
  logger.trace('        getImageUrls - has ',(images.length===0)?'no':images.length,' image', resourceID, resourceKey);

  return {images, noImagesReplyCode};
}

