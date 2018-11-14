import logger from './logger';

export default async function getResources(client) {
  logger.strong('getResources');
  let data = await client.metadata.getResources();

  return data.results[0].metadata.map(_ => {
    return {resourceID: _.ResourceID, keyField: _.KeyField};
  });
}
