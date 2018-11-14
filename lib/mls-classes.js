import logger from './logger';

export default async function getClasses(client, resource) {
  logger.log('  getClass', resource.resourceID);
  let data = await client.metadata.getClass(resource.resourceID);
  let aClass =  data.results[0].metadata;
  logger.trace('    getTable', resource.resourceID, aClass.ClassName);

  return await Promise.all(aClass.map(async _ => {
    let fieldsData = await client.metadata.getTable(resource.resourceID, _.ClassName);
    return {
      className: _.ClassName,
      description: _.Description,
      classTimestamp: _.ClassTimeStamp,
      resourceID: resource.resourceID,
      keyField: resource.keyField,
      fields: fieldsData.results[0].metadata,
      "sync": true,
      "syncImages": true,
      "wixCollection": resource.resourceID
    }
  }))
};
