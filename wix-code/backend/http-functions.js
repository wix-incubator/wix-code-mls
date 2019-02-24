import {ok, serverError, forbidden} from 'wix-http-functions';
import wixData from 'wix-data';
import crypto from 'crypto';
import PromiseQueue from 'promise-queue';

const secret = '...YOUR wix-code-rets SECRET, FROM THE CONFIG FILE...';
// URL to call this HTTP function from your published site looks like:
// Premium site - https://mysite.com/_functions/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions/example/multiply?leftOperand=3&rightOperand=4

// URL to test this HTTP function from your saved site looks like:
// Premium site - https://mysite.com/_functions-dev/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions-dev/example/multiply?leftOperand=3&rightOperand=4

function Queue(concurrency, tasks) {
  return new Promise(function(resolve, reject) {
    let q = new PromiseQueue(concurrency, Infinity, {onEmpty: function() {
      if (q.getPendingLength() === 0)
        resolve();
    }});

    if (tasks.length > 0)
      tasks.forEach(_ => q.add(_));
    else
      resolve();
  })
}

export async function post_saveItemBatch(request) {
  console.log('saveItemBatch start');
  const payload = await request.body.text();
  const payloadJson = JSON.parse(payload, dateReviver);
  const collection = payloadJson.collection;
  const items = payloadJson.data;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(items, dateReplacer) + collection);
  if (hmac.digest('hex') !== payloadJson.signature) {
    return forbidden({body: 'invalid signature'});
  }

  try {
    let bulkResult = await wixData.bulkSave(collection, items, {suppressAuth: true});
    console.log('saveItemBatch bulkUpdate', bulkResult);
  }
  catch (e) {
    return ok({body: e.stack});
  }
  console.log('saveItemBatch completed');
  return ok({body: 'ok'});
}

export async function post_clearStale(request) {
  console.log('clearStale start');
  const payload = await request.body.text();
  const payloadJson = JSON.parse(payload, dateReviver);
  const collection = payloadJson.collection;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(collection);
  if (hmac.digest('hex') !== payloadJson.signature) {
    return forbidden({body: 'invalid signature'});
  }

  try {
    let date = new Date();
    date.setDate(date.getDate() - 3);

    console.log('clearStale - query clear stale for', collection);
    let res = await wixData.query(collection)
      .lt('_updatedDate', date)
      .find({suppressAuth: true});
    console.log(`clearStale - found ${res.totalCount} items to remove, current page ${res.length}`);
    let itemsToDelete = res.items;
    let removed = 0;
    let errors = 0;
    let tasks = [];
    for (let i=0; i < itemsToDelete.length; i++) {
      tasks.push(async function() {
        try {
          await wixData.remove(collection, itemsToDelete[i]._id, {suppressAuth: true});
          removed++
        }
        catch (e) {
          console.log(`clearStale - delete item - error`, e.stack);
          errors++
        }
      });
    }
    await Queue(10, tasks);

    return ok({body: {itemsRemoved: removed, staleItems: res.totalCount - removed, errors: errors}});
  }
  catch (e) {
    console.log(`clearStale - error`, e.stack);
    return ok({body: e.stack});
  }
}

export async function post_batchCheckUpdateState(request) {
  console.log('batchCheckUpdateState start');
  try {
    const payload = await request.body.text();
    const payloadJson = JSON.parse(payload, dateReviver);
    const collection = payloadJson.collection;
    const items = payloadJson.data.items; //{id}[]

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payloadJson.data, dateReplacer) + collection);
    if (hmac.digest('hex') !== payloadJson.signature) {
      return forbidden({body: 'invalid signature'});
    }

    console.log('batchCheckUpdateState input items:', items.length);
    let queries = items.map(item => wixData.query(collection).eq('_id', item.id));
    console.log('batchCheckUpdateState input queries:', items.length);
    let query = queries.reduce((accuQuery, query) => (!!accuQuery)?accuQuery.or(query): query);
    let result = [];
    let itemsToUpdate = [];
    let cOk =0, cNeedUpdate = 0, cNotFound = 0;
    try {
      let res = await query.find({suppressAuth: true});
      console.log('batchCheckUpdateState query results:', res.items.length);

      items.forEach(item => {
        let foundItem = res.items.find(_ => _._id === item.id);
        if (foundItem && foundItem._hash === item.hash && foundItem.mainImage) {
          itemsToUpdate.push(foundItem);
          cOk += 1;
          result.push({status: 'ok', id: item.id});
        }
        else if (foundItem) {
          cNeedUpdate += 1;
          result.push({status: 'need-update', id: item.id});
        }
        else {
          cNotFound += 1;
          result.push({status: 'not-found', id: item.id});
        }

      });

    }
    catch(e) {
      result.push({status: 'error', error: e.message});
    }

    console.log('batchCheckUpdateState items to update:', itemsToUpdate.length);
    console.log(`batchCheckUpdateState results: ${result.length} - ${cOk}/${cNeedUpdate}/${cNotFound}`);
    let updateResult = await wixData.bulkUpdate(collection, itemsToUpdate, {suppressAuth: true});
    console.log('batchCheckUpdateState bulkUpdate result', updateResult);
    console.log('batchCheckUpdateState complete', result);
    return ok({body: JSON.stringify(result)});
  }
  catch (e) {
    console.log('batchCheckUpdateState error', e.message, e.stack);
    return ok({body: e.stack});
  }
}


const dateRegex = /^Date\((\d+)\)$/;
function dateReviver(key, value) {
  const match = dateRegex.exec(value);
  if (match) {
    return new Date(Number(match[1]));
  }
  return value;
}

function dateReplacer(key, value) {
  let v = this[key];
  if (v instanceof Date)
    return 'Date('+v.getTime()+')';
  else
    return value
}