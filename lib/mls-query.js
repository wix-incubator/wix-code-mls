module.exports = async function (client, resourceId, className, classTimestampField, keyField, logger) {
  try {
    let res = {results: []};
    let offset = 0;
    let count;
    const pageSize = 10000;

    do {
      let mlsResult;
      if (!!classTimestampField)
        mlsResult = await client.search.query(resourceId,
          className, `(${classTimestampField}=2010-01-01+)`,
          {limit: pageSize, offset: offset});
      else
        mlsResult = await client.search.query(resourceId,
          className, `(${keyField}=~ABCD)`,
          {limit: pageSize, offset: offset});

      if (!count) {
        count = mlsResult.count;
      }
      logger.trace(`    query page (${pageSize}/${offset}) total: ${count}`);

      res.results = res.results.concat(mlsResult.results);
      offset += pageSize;

    } while (count > offset);

    return res;
  }
  catch (e) {
    if (e.replyCode === '20201') {
      logger.log(    `${resourceId} ${className}: no records found`);
      return {results: []};
    }
    else
      throw e;
  }
};