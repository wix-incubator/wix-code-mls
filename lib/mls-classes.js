module.exports = async function getClasses(client, resource, logger) {
  logger.log('getClass', resource.resourceID);
  let data = await client.metadata.getClass(resource.resourceID);
  let aClass = data.results[0].metadata;
  let fieldsData = await client.metadata.getTable(resource.resourceID, aClass.ClassName);

  return aClass.map(_ => {
    return {
      className: _.ClassName,
      description: _.Description,
      classTimestamp: _.ClassTimeStamp,
      resourceID: resource.resourceID,
      keyField: resource.keyField,
      fields: fieldsData.results[0].metadata
    }
  })
};
