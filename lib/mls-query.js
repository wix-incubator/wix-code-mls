import logger from './logger';
import moment from 'moment';
import vm from 'vm';
const findCode = /{([^{}]*)}/g;

export default async function (client, tableConfig, pageSize, offset) {
  try {
    let mlsResult;
    let {resourceID: resourceId, className, classTimestamp: classTimestampField, keyField, filter, fields} = tableConfig;
    if (filter) {
      filter = filter.replace(findCode, function(_) {
        let a =_.substring(1, _.length-1);
        const script = new vm.Script(a);
        const context = vm.createContext({moment: moment});
        return script.runInContext(context);
      });
      mlsResult = await client.search.query(resourceId,
        className, filter,
        {limit: pageSize, offset: offset});
    }
    else if (!!classTimestampField)
      mlsResult = await client.search.query(resourceId,
        className, `(${classTimestampField}=2010-01-01+)`,
        {limit: pageSize, offset: offset});
    else if (!!keyField) {
      let keyFieldDefinition = fields.find(_ => _.SystemName === keyField);
      if (!keyFieldDefinition)
        throw new Error('Failed to run MLS query due to missing config. Key field defined in schema not found in the fields definition in the schema. Please set a filter')

      let keyFieldType = keyFieldDefinition.DataType;
      if (keyFieldType === 'Int' || keyFieldType === 'Long') {
        mlsResult = await client.search.query(resourceId,
          className, `(${keyField}=0+)`,
          {limit: pageSize, offset: offset});
      }
      else if (keyFieldType === 'Character') {
        mlsResult = await client.search.query(resourceId,
          className, `(${keyField}=~ABCD)`,
          {limit: pageSize, offset: offset});
      }
    }

    if (!mlsResult)
      throw new Error('Failed to run MLS query due to missing config. No user specified DMQL2 filter, no timestamp field and no key field of supported type');

    if (mlsResult.replyCode !== '0') {
      throw new Error(`Failed to run MLS query due to replyCode ${mlsResult.replyCode}, replyTag ${mlsResult.replyTag}, replyText ${mlsResult.replyText}`)
    }

    return {
      count: mlsResult.count,
      results: mlsResult.results
    };

  }
  catch (e) {
    let {resourceID: resourceId, className} = tableConfig;

    if (e === undefined) {
      logger.log(    `${resourceId} ${className}: got undefined error from MLS `);
      return {results: [], count: NaN};
    }
    if (e && e.replyCode === '20201') {
      logger.log(    `${resourceId} ${className}: no records found`);
      return {results: [], count: 0};
    }
    else
      throw e;
  }
};