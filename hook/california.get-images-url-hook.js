module.exports = function defaultGetImageUrls(client, item, resourceID, keyField, itemIndex, logger) {
  let resourceRecordKeyNum = item['listingKeyNumeric'];
  logger.trace('        query on Media Media with filter', `(ResourceRecordKeyNumeric=${resourceRecordKeyNum})`);
  return client.search.query('Media', 'Media', `(ResourceRecordKeyNumeric=${resourceRecordKeyNum})`,
    {limit: 200, offset: 0})
    .then(res => {
      return res.results.map(_ => _.MediaURL);
    })
};