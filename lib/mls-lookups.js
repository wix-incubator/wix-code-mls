import logger from './logger';

export default async function getLookups(client, clazz) {
  logger.log('  getLookups', clazz.resourceID, clazz.className);
  for (let i=0; i < clazz.fields.length; i++) {
    let field = clazz.fields[i];
    if (field.Interpretation === 'Lookup') {
      logger.trace('    getLookupTypes', clazz.resourceID, clazz.className, field.LongName);
      let lookupValues = await client.metadata.getLookupTypes(clazz.resourceID, field.LookupName);
      if (lookupValues.results.length > 0)
        field.lookupValues = lookupValues.results[0].metadata;
    }
  }
};
