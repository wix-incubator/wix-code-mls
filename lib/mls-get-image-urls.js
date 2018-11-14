import logger from './logger';
export default async function getImageUrls(client, item, resourceID, keyField, itemIndex) {
  let resourceKey = item[keyField];
  logger.log('      getImageUrls', resourceID, 'Photo', resourceKey, 'item', itemIndex);
  let photoResults = await client.objects.getAllObjects(resourceID, 'Photo', [resourceKey], {alwaysGroupObjects: true, ObjectData: '*', Location: 1});

  let images = [];
  for (let i = 0; i < photoResults.objects.length; i++) {
    if (photoResults.objects[i].type === 'headerInfo') {
      // ignore the header
    }
    else if (photoResults.objects[i].error) {
      if (photoResults.objects[i].error.replyCode === '20403') {
        // no objects found
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

  return images;
};

