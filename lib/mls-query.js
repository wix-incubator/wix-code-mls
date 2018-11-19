import logger from './logger';
import moment from 'moment';
import vm from 'vm';
const findCode = /{([^{}]*)}/g;

export default async function (client, resourceId, className, classTimestampField, keyField, pageSize, offset, filter) {
  try {
    let mlsResult;
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
    else
      mlsResult = await client.search.query(resourceId,
        className, `(${keyField}=~ABCD)`,
        {limit: pageSize, offset: offset});

    return {
      count: mlsResult.count,
      results: mlsResult.results
    };

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