let mediaSdk = require('@wix/media-manager-js-sdk');

let AddedBy = mediaSdk.AddedBy;

let MediaPlatform = mediaSdk.MediaPlatform;
let UploadRequest = mediaSdk.file.UploadRequest;

function makeMediaPlatform(mediaCredentials) {
  return new MediaPlatform({
    domain: 'files.wix.com',
    appId: mediaCredentials.id,
    sharedSecret: mediaCredentials.secret.key
  });
}
async function upload(mediaPlatform, resourceId, index, mediaConfig, fileContent, ext, logger) {
  let fileName = `Photo ${resourceId}-${index}.${ext}`;
  let uploadRequest = new UploadRequest()
    .setFileName(fileName)
    .setContentType('image/' + ext)
    .addTags('cat', 'fish');
//  .setParentFolderId('');

  let fileUploader = mediaPlatform.fileUploader;
  return new Promise(function(resolve, reject) {
    fileUploader.uploadSiteImage(mediaConfig.metasiteId,
      new AddedBy('user', mediaConfig.userId),
      fileContent, uploadRequest, function (error, response) {
        if (error) {
          logger.error('      upload failed: ', error.message, error.stack);
          reject(error);
          return;
        }
        let mediaFilename = response.fileName;
        let height = response.height;
        let width = response.width;
        let url = `image://v1/${mediaFilename}/${width}_${height}/${fileName}`;
        logger.trace('      upload successful: ', url);
        resolve(url);
      });
  });
}

module.exports = async function importImages(client, item, mediaCredentials, mediaConfig, siteAPI, resourceID, keyField, logger) {
  let resourceKey = item[keyField];
  logger.log('  importImages', resourceID, 'Photo', resourceKey);
  let photoResults = await client.objects.getAllObjects(resourceID, 'Photo', [resourceKey], {alwaysGroupObjects: true, ObjectData: '*'});

  let mediaPlatform = makeMediaPlatform(mediaCredentials);

  let images = [];
  for (let i = 0; i < photoResults.objects.length; i++) {
    if (photoResults.objects[i].type === 'headerInfo') {
      // ignore the header
    }
    else if (photoResults.objects[i].error) {
      if (photoResults.objects[i].error.replyCode === '20403') {
        // no objects found
        logger.trace(`    importImages - no photos found for ${resourceID} - ${resourceKey}`);
      }
      else
        logger.warn(`    importImages - Error reading ${resourceID} photos for key ${resourceKey}: ${photoResults.objects[i].error}`);
    }
    else if (photoResults.objects[i].data && photoResults.objects[i].headerInfo.contentType) {
      // a photo
      let fileExtension = photoResults.objects[i].headerInfo.contentType.match(/\w+\/(\w+)/i)[1];
      let fileData = photoResults.objects[i].data;
      logger.trace('    importImages - uploading image',i , resourceID, resourceKey, fileExtension);
      try {
        let url = await upload(mediaPlatform, resourceKey, i, mediaConfig, fileData, fileExtension, logger);
        images.push({
          type: 'image',
          src: url
        });
        module.exports.uploadedImages++;
      }
      catch (error) {
        module.exports.failedUploadImages++;
      }
    }
  }
  return images;
};

module.exports.uploadedImages = 0;
module.exports.failedUploadImages = 0;

