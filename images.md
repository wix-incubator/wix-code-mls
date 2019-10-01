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
  keyField: String, itemIndex: Integer, logger: Logger): Promise<Array<String>>
```

* client - an instance of rets-client. Read more at [rets-client NPM module](https://www.npmjs.com/package/rets-client)
* item - the Resource as a javascript object
* resourceID - the resource id of the item, as in the schema file
* keyField - the name of the key field, taken from the schema file
* itemIndex - the number of the item in this sync process, great for logging
* logger - a logger instance, as defined in [logger.js](https://github.com/wix/wix-code-mls/blob/master/lib/logger.js)
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
