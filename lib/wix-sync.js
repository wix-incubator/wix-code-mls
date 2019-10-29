import axios from 'axios';
import crypto from 'crypto';
import logger from './logger';
import * as request from 'request-promise';
import Queue from './queue';

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

const zip = (arr, ...arrs) => {
  return arr.map((val, i) => arrs.reduce((a, arr) => [...a, arr[i]], [val]));
};

export async function uploadImages(imagesData, resourceID, resourceKey, siteAPI) {
  let data = {
    mimeTypes: imagesData.map(_ => _.mimeType),
    resource: resourceID,
    id: resourceKey
  };

  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(JSON.stringify(data, dateReplacer));
  let payload = {
    data: data,
    signature: hmac.digest('hex')
  };
  let result = await withRetry(
    () => post(siteAPI.getImageUploadUrl, payload), shouldRetry);

  const uploadUrls = result.data;
//  const uploadUrlsAndData = zip(imagesData, uploadUrls);

  //upload the images
  let urls = [];
  await Queue(1, imagesData.map((item, index) => {
    const imageDataObj = item;
    const uploadUrlObj = uploadUrls[item.mimeType];
    return async function() {
      logger.trace(`        importImages - ${resourceID} - ${resourceKey} uploading image ${index} of ${imagesData.length}`);
      let url = await uploadImageViaUploadUrl(uploadUrlObj.uploadUrl, uploadUrlObj.uploadToken, imageDataObj.imageData,
        `${resourceID}-${resourceKey}-${index}.jpg`, imageDataObj.mimeType);
      urls.push(url);
    }
  }));
  return urls;
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
    (error.message === 'read ECONNRESET') ||
    (error.message === 'Request failed with status code 502'))
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

async function uploadImageViaUploadUrl(uploadUrl, uploadToken, contentStream, fileName, contentType) {
  const body = {
    upload_token: uploadToken,
    file: {
      value: contentStream,
      options: {
        filename: fileName,
        contentType: contentType
      }
    }
  };

  const response = await request.post({url: uploadUrl, formData: body, json: true});
  return `wix:image://v1/${response[0].file_name}/${response[0].original_file_name}#originWidth=${response[0].width}&originHeight=${response[0].height}`;
}