# Schema Config

The schema config file determines how to synchronize a MLS resource & class table into a Wix Collection. It allows to control

* should the resource and class be synced at all?
* the target collection at Wix
* should we sync images?
* should we use a custom strategy to get image urls?
* which filter to use for reading data from MLS server

The structure of the schema file includes the following

```json
[
  {
    "resourceID": "resource_name",
    "className": "class_id",
    "description": "class description",
    "classTimestamp": "L_UpdateDate",
    "keyField": "L_ListingID",
    "fields": [...]
    "sync": true,
    "syncImages": true,
    "filter": "MLS Query filter",
    "wixCollection": "collection name",
    "overrideGetImagesUrl": "filename"
  },
  ...
]
```

## selecting which resource & class to sync

To set a resource and class to be synced, set the `sync` parameter for that class and resource to be `true`.
To prevent syncing of that resource and class, set the parameter to `false`.

## target collection in Wix

The `wixCollection` parameter determines which collection in the Wix Website to sync this resource and class with.
By default the name of the collection is the same as the resource name, but it can be changed. Keep in mind you need to
create the collection and publish the site (if syncing with the live database).

## selecting to sync images

When running the MLS sync, some resources do not support images. If we try to sync images for a resource that does not support images
we will see an error reported like

```
0:0:30          getImageUrls Resource Photo ...id... item 32
(node:64765) UnhandledPromiseRejectionWarning: Unhandled promise rejection (rejection id: 23): RetsReplyError:
RETS Server reply while attempting getObject - ReplyCode 20400 (INVALID_RESOURCE);
ReplyText: RETS Server: Invalid Resource parameter in request.
...
```

To prevent syncing images for that resource, set `syncImages` to `false`.

## Alternate strategy for fetching image URLs

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

## Filtering Resource & Class

MLS server queries require a filter. The integration creates a default filter using the resource & class metadata -

If the resource & class have a `classTimestampField`, it is used in the query as `(<classTimestamp field name>=2010-01-01+)`.
If the resource & class do not have a `classTimestampField`, we use the key field as `(<key field name>=~ABCD)`.

In some cases, you want to modify the filter.

1. In some cases, the logic above is not sufficient and you will see errors like
   ```
   0:0:1    Failed to sync Resource A RetsReplyError:
   RETS Server reply while attempting search - ReplyCode 20207 (UNAUTHORIZED_QUERY);
   ReplyText: RETS Server: Field (<field name>) is not searchable.
   ```

2. In other cases, the server will return old listing data, for instance listings from 4-5 years ago.

to setup a filter, set a `filter` member in the schema file. valid examples are

```json
[
  {
    "resourceID": "resource_name",
    "className": "class_id",
    ...
    "filter": "(ROOM_1=~ABCD)"
  },
  ...
]
```

and

```json
[
  {
    "resourceID": "resource_name",
    "className": "class_id",
    ...
    "filter": "(LIST_15=|17VDTYRGSYG4)"
  },
  ...
]
```

Note that filters are written using the field system name.

### Filtering using lookup fields

In the second example above, the `LIST_15` field is a lookup field. The field schema is for instance -

```json
{
  "MetadataEntryID": "...",
  "SystemName": "LIST_15",
  "StandardName": "ListingStatus",
  "LongName": "Status",
  "DBName": "status",
  "DataType": "Character",
  "Searchable": "1",
  "Interpretation": "Lookup",
  "lookupValues": [
    {
      "MetadataEntryID": "84d72c3feb5ef1418c18c228ac807839",
      "LongValue": "Active",
      "ShortValue": "Active",
      "Value": "17VL9WOQ0MW8"
    },
    {
      "MetadataEntryID": "ff465e7778527ab4e2d64a19966dafe5",
      "LongValue": "Pending",
      "ShortValue": "Pending",
      "Value": "17VL9WOQ0SA0"
    },
    {
      "MetadataEntryID": "d46c00e410719c98ece18b18bc8090d9",
      "LongValue": "Sold",
      "ShortValue": "Sold",
      "Value": "17ZFUQ2B92WI"
    }
  ]
}
```

The corresponding field in Wix will be `Status`, with values `Active`, `Pending` and `Sold`.

To setup a filter to only sync `Active` `Status`, the expression will be `"filter": "(LIST_15=|17VL9WOQ0MW8)"`.

e.g.
`(<SystemName> =|<LookupValues[].Value>)`

### Filtering using date fields

When filtering on date fields, in most cases the filter should be dynamic, relative to the current date.

MLS query filters support filters on dates using a format like `(EVENT200=2018-06-01T00:00:00+)`.

In order to generate the date string in the filter dynamically, the wix-code-mls allows to run code expressions
as part of the filter format. The `{}` brackets designate javascript code that is run as part of the sync process.
The javascript code can use the moment javascript library to manipulate dates

For instance, to get a filter for anything 30 days old and newer, use the following
```
(EVENT200={moment().subtract(30, 'day').format('YYYY-MM-DDThh:mm:ss')}+)
```


