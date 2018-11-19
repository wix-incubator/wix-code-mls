import axios from 'axios';
import crypto from 'crypto';
import logger from './logger';

function dateReplacer(key, value) {
  let v = this[key];
  if (v instanceof Date)
    return 'Date('+v.getTime()+')';
  else
    return value
}

export async function saveItemBatch(items, siteAPI, wixCollection) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(JSON.stringify(items, dateReplacer) + wixCollection);
  const payload = {
    data: items,
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await withRetry(
    () => post(siteAPI.saveItemBatch, payload), shouldRetry);
  return result.data;
}

export async function batchCheckUpdateState(items, siteAPI, wixCollection) {
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
  let result = await withRetry(
    () => post(siteAPI.batchCheckUpdateState, payload), shouldRetry);
  return result.data; // {status: not-found | ok | need-update, id: string}[]
}

export async function clearStaleItems(siteAPI, wixCollection) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(wixCollection);
  let payload = {
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await withRetry(
    () => post(siteAPI.clearStale, payload), shouldRetry);
  return result.data; // {itemsRemoved, staleItems, errors}
}

function sleep(millis) {
  return new Promise(function(resolve) {
    setTimeout(resolve, millis);
  })
}

function shouldRetry(error, retryNum) {
  return (
    (error.message === 'Internal wixData error: Failed to parse server response') ||
    (error.message === 'read ECONNRESET'))
    && retryNum < 4;
}

async function withRetry(op, shouldRetryPredicate) {
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
        sleep(500*retryNum);
      }
      else {
        logger.trace('  another error', e.stack);
        throw e;
      }
    }
  } while (shouldRetry)
}

async function post(url, payload) {
  try {
     return await axios.post(url, JSON.stringify(payload, dateReplacer))
  }
  catch (err) {
    logger.error(`    Error: calling site API - POST ${url} \n      ${err.message}`);
    throw err;
  }
}