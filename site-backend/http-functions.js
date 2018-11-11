import {ok, serverError, forbidden} from 'wix-http-functions';
import wixData from 'wix-data';
import crypto from 'crypto';
import Queue from './queue';

const secret = 'ee971f4a-8a30-4a10-882f-1114ee679a8a';
// URL to call this HTTP function from your published site looks like:
// Premium site - https://mysite.com/_functions/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions/example/multiply?leftOperand=3&rightOperand=4

// URL to test this HTTP function from your saved site looks like:
// Premium site - https://mysite.com/_functions-dev/example/multiply?leftOperand=3&rightOperand=4
// Free site - https://username.wixsite.com/mysite/_functions-dev/example/multiply?leftOperand=3&rightOperand=4


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
    let tasks = [];
    for (let i=0; i < items.length; i++) {
      tasks.push(async function() {
//    			console.info('saving item', i);
        return await wixData.save(collection, items[i], {suppressAuth: true});
      })
    }
    await Queue(5, tasks);
  }
  catch (e) {
    return ok({body: e.stack});
  }
  console.log('saveItemBatch completed');
  return ok({body: 'ok'});
}

export async function post_saveItemBatch2(request) {
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
    let count = 0;
    let date = new Date();
    date.setDate(date.getDate() - 1);

    console.log('before query', collection, date);
    let res = await wixData.query(collection)
      .lt('_updatedDate', date)
      .find({suppressAuth: true});
    console.log('after query', res.length);
    while (res.length > 0) {
      console.log('found', res.length);
      count += res.length;
      let itemsToDelete = res.items;
      for (let i=0; i < itemsToDelete.length; i++) {
        await wixData.remove(collection, itemsToDelete[i]._id, {suppressAuth: true});
      }
      console.log('before query', collection, date);
      res = await wixData.query(collection)
        .lt('_updatedDate', date)
        .find({suppressAuth: true});
      console.log('after query', res.length);
    }
    return ok({body: ''+count});
  }
  catch (e) {
    return ok({body: e.stack});
  }
}

export async function post_clearStale2(request) {
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
    date.setDate(date.getDate() - 1);

    console.log('clearStale - query clear stale for', collection);
    let res = await wixData.query(collection)
      .lt('_updatedDate', date)
      .find({suppressAuth: true});
    console.log(`clearStale - found ${res.totalCount} items to remove, current page ${res.length}`);
    let itemsToDelete = res.items;
    let removed = 0;
    let errors = 0;
    for (let i=0; i < itemsToDelete.length; i++) {
      try {
        await wixData.remove(collection, itemsToDelete[i]._id, {suppressAuth: true});
        removed++
      }
      catch (e) {
        console.log(`clearStale - delete item - error`, e.stack);
        errors++
      }
    }
    return ok({body: {itemsRemoved: removed, staleItems: res.totalCount - removed, errors: errors}});
  }
  catch (e) {
    console.log(`clearStale - error`, e.stack);
    return ok({body: e.stack});
  }
}

export async function post_batchCheckUpdateState2(request) {
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
    let result = [];
    let tasks = [];
    let itemsToUpdate = [];
    let cOk =0, cNeedUpdate = 0, cNotFound = 0;
    for (let i=0; i < items.length; i++) {
      tasks.push(async function() {
        let id = items[i].id;
        try {
          let hash = items[i].hash;
          let item = await wixData.get(collection, id, {suppressAuth: true});
          if (item && item._hash === hash) {
            itemsToUpdate.push(item);
            cOk += 1;
            result.push({status: 'ok', id: id});
          }
          else if (item) {
            cNeedUpdate += 1;
            result.push({status: 'need-update', id: id});
          }
          else {
            cNotFound += 1;
            result.push({status: 'not-found', id: id});
          }
        }
        catch(e) {
          result.push({status: 'error', id: id, error: e.message});
        }
      })
    }
    await Queue(5, tasks);

    console.log('batchCheckUpdateState items to update:', itemsToUpdate.length);
    console.log(`batchCheckUpdateState results: ${result.length} - ${cOk}/${cNeedUpdate}/${cNotFound}`);
    let tasks2 = [];
    for (let i=0; i < itemsToUpdate.length; i++) {
      tasks2.push(async function() {
        return await wixData.update(collection, itemsToUpdate[i], {suppressAuth: true});
      })
    }
    await Queue(5, tasks2);
    console.log('batchCheckUpdateState complete');
    return ok({body: JSON.stringify(result)});
  }
  catch (e) {
    console.log('batchCheckUpdateState error', e.message, e.stack);
    return ok({body: e.stack});
  }
}

export async function post_batchCheckUpdateState3(request) {
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
        if (foundItem && foundItem._hash === item.hash) {
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