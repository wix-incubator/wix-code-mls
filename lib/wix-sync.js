const axios = require('axios');
const crypto = require('crypto');

function dateReplacer(key, value) {
  let v = this[key];
  if (v instanceof Date)
    return 'Date('+v.getTime()+')';
  else
    return value
}

module.exports.saveItemBatch = async function(items, siteAPI, wixCollection, logger) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(JSON.stringify(items, dateReplacer) + wixCollection);
  const payload = {
    data: items,
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await post(siteAPI.saveItemBatch, payload, logger);
  return result.data;
};

module.exports.batchCheckUpdateState = async function(items, siteAPI, wixCollection, logger) {
  let data = {
    items: items.map(_ => {return {id: _._id, hash: _._hash}})
  };
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(JSON.stringify(data, dateReplacer) + wixCollection);
  let payload = {
    data: data,
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await post(siteAPI.batchCheckUpdateState, payload, logger);
  return result.data; // {status: not-found | ok | need-update, id: string}[]
};

module.exports.clearStaleItems = async function(siteAPI, wixCollection, logger) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(wixCollection);
  let payload = {
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await withRetry(
    () => post(siteAPI.clearStale, payload, logger),
    (e, retryNum) => e.message === 'Internal wixData error: Failed to parse server response' && retryNum < 3,
    logger
  );
  return result.data; // {itemsRemoved, staleItems, errors}
};

function sleep(millis) {
  return new Promise(function(resolve) {
    setTimeout(resolve, millis);
  })
}

async function withRetry(op, shouldRetryPredicate, logger) {
  let shouldRetry = false;
  let retryNum = 0;
  do {
    try {
      return await op();
    }
    catch (e) {
      shouldRetry = shouldRetryPredicate(e, retryNum++);
      logger.trace('  retrying...');
      if (shouldRetry) {
        sleep(100);
      }
      else {
        logger.trace('  another error', e.stack);
        throw e;
      }
    }
  } while (shouldRetry)
}

async function post(url, payload, logger) {
  try {
     return await axios.post(url, JSON.stringify(payload, dateReplacer))
  }
  catch (err) {
    logger.error(`    Error: calling site API - POST ${url} \n      ${err.message}`);
    throw err;
  }
}