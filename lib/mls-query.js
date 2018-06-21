module.exports = async function (client, resourceId, className, classTimestampField, logger) {
  try {
    return await client.search.query(resourceId,
      className, `(${classTimestampField}=2010-01-01+)`,
      {limit: 50000, offset: 0});
  }
  catch (e) {
    if (e.replyCode === '20201') {
      logger.log(`${resourceId} ${className}: no records found`);
      return [];
    }
    else
      throw e;
  }
};