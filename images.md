# Strategies to support images with MLS servers

One of rhe challenges with MLS servers is supporting images.

## default strategy

The baseline and default strategy is using Location=1 to get image urls, where the images are stored and served directly from the MLS server.

In this case, we obtain the image urls using the `getObject` RETS operation, with the `Photo` object type.


## alternate object type

Some servers link by default to low resolution images. They support high resolution images using an alternate object type.

### How to detect

Getting low res images using the default strategy

### How to fix

In the schema file, set the `alternateImageObjectType` property to the object type to use instead of `Photo`.
We have seen, with some servers, that the value what worked for us was `HiRes`


## MLS server does not serve images publicly - does not support `Location=1`

Some servers do not allow to link directly to the images they store, instead requiring an integration to download the images
and load them to another server to be publicly available on the web.

### how to detect

When syncing, we get an error with something like `Location=1 not supported`

### how to fix

We turn on the upload / import of images to wix, by setting `importImagesToWixMedia` in the schema file.

Do note that by setting this flag, the integration time will increase considerably.


## Alternate strategy for fetching image URLs

we have seen one server who, instead of supporting images using the getObject RETS operation, has a RETS Resource for images.

Alternate strategy allows writing a javascript hook to customize how to lookup image urls.

By specifying the `overrideGetImagesUrl` parameter, the integration will lookup a Node.js module relative to the root of the running process.
It will load the module and use the default exported function get a resource images instead of the default strategy.

The signature expected from the module -

```
function getImageUrls(client: RetsClient, item: Object, resourceID: String,
  keyField: String, itemIndex: Integer, logger: Logger, uploadImagesToWix: (Array<{imageData: Buffer, mimeType: String}>) => Promise<Array<String>>): Promise<Array<String>>
```

* client - an instance of rets-client. Read more at [rets-client NPM module](https://www.npmjs.com/package/rets-client)
* item - the Resource as a javascript object
* resourceID - the resource id of the item, as in the schema file
* keyField - the name of the key field, taken from the schema file
* itemIndex - the number of the item in this sync process, great for logging
* logger - a logger instance, as defined in [logger.js](https://github.com/wix/wix-code-mls/blob/master/lib/logger.js)
* uploadImagesToWix - a function that can load an array of Buffers containing image data to Wix storage and retrieve image URLs
* returns - a promise that is resolved to an array of media URLs. For no images resolve to an empty array.

The default strategy is to lookup resource images using `getObjects` call with the `Resource`, `Class` and `ResourceID`.

### Example

Alternate strategy that reads images from the `Media` Resource using `Query` instead of `getObjects`.

```
module.exports = function defaultGetImageUrls(client, item, resourceID, keyField, itemIndex, logger) {
  let resourceRecordKeyNum = item['listingKeyNumeric'];
  logger.trace('        query on Media Media with filter', `(ResourceRecordKeyNumeric=${resourceRecordKeyNum})`);
  return client.search.query('Media', 'Media', `(ResourceRecordKeyNumeric=${resourceRecordKeyNum})`,
    {limit: 200, offset: 0})
    .then(res => {
      return res.results.map(_ => _.MediaURL);
    })
};
```

### Another Example

Alternate strategy that reads images using GetObjects from a server that only returns a single image at a time, requiring the client to
ask for images with resourceKey:imageIndex, and upload the images to Wix storage

```
module.exports = async function defaultGetImageUrls(client, item, resourceID, keyField, itemIndex, logger, uploadImagesToWix) {
  let resourceKey = item['matrix_unique_ID'];

  let imageIndex = 1;
  let imagesToUpload = [];
  let hasMoreImages = true;
  while (hasMoreImages) {
    logger.trace(`        getObject?Type=VLargePhoto&Resource=${resourceID}&ID=${resourceKey}:${imageIndex} item ${itemIndex}`);
    try {
      let photoResults = await client.objects.getAllObjects(resourceID, 'VLargePhoto', [`${resourceKey}:${imageIndex}`], {
        alwaysGroupObjects: true,
        ObjectData: '*',
      });

      let imagesData = photoResults.objects.filter(obj => {
        if (obj.type === 'headerInfo') {
          return false;
        }
        else if (obj.error) {
          if (obj.error.replyCode === '20403') {
            // no objects found
            hasMoreImages = false;
            if (imageIndex === 1)
              logger.trace(`        importImages - no photos found for ${resourceID} - ${resourceKey}`);
            return false;
          }
          else
            logger.warn(`        importImages - Error reading ${resourceID} photos for key ${resourceKey}:${imageIndex}: ${obj.error}`);
          return false;
        }
        else
          return true;
      }).map(obj => {
        return {imageData: obj.data, mimeType: obj.headerInfo.contentType};
      });

      // only add the first image, as we get duplicate images in this call
      if (imagesData.length > 0)
        imagesToUpload.push(imagesData[0]);
    }
    catch (err) {
      if (err.replyCode === '20403') {
        logger.trace(`        importImages - no photos found for ${resourceID} - ${resourceKey}`);
        hasMoreImages = false;
      }
      else
        throw err;
    }

    imageIndex = imageIndex + 1;
  }

  return await uploadImagesToWix(imagesToUpload);
};```
