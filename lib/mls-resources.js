module.exports = async function getResources(client, logger) {
  logger.log('getResources');
  let data = await client.metadata.getResources();

  return data.results[0].metadata.map(_ => {
    return {resourceID: _.ResourceID, keyField: _.KeyField};
  });
}
