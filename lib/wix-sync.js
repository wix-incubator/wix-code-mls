const axios = require('axios');
const crypto = require('crypto');

function dateReplacer(key, value) {
  let v = this[key];
  if (v instanceof Date)
    return 'Date('+v.getTime()+')';
  else
    return value
}

module.exports.saveItemBatch = async function(items, siteAPI, wixCollection) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(JSON.stringify(items, dateReplacer) + wixCollection);
  const payload = {
    data: items,
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await axios.post(siteAPI.saveItemBatch, JSON.stringify(payload, dateReplacer));
  return result.data;
};

module.exports.batchCheckUpdateState2 = async function(items, siteAPI, wixCollection, logger) {
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
  let result = await axios.post(siteAPI.batchCheckUpdateState2, JSON.stringify(payload, dateReplacer));
  return result.data; // {status: not-found | ok | need-update, id: string}[]
};

module.exports.clearStaleItems = async function(siteAPI, wixCollection) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(wixCollection);
  let payload = {
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await axios.post(siteAPI.clearStale, JSON.stringify(payload));
  return result.data; // {status: not-found | ok | need-update, id: string}[]
};

module.exports.clearStaleItems2 = async function(siteAPI, wixCollection) {
  const hmac = crypto.createHmac('sha256', siteAPI.secret);
  hmac.update(wixCollection);
  let payload = {
    collection: wixCollection,
    signature: hmac.digest('hex')
  };
  let result = await axios.post(siteAPI.clearStale2, JSON.stringify(payload));
  return result.data; // {itemsRemoved, staleItems, errors}
};

//curl -d '{"data":{"id": "xxx", "lastUpdate": "Date(1529176569363), "lastUpdateField: "L_UpdateDate"}, "collection":"Properties"}' -H "Content-Type: application/json" -X POST https://yoav68.wixsite.com/mls-rets/_functions-dev/checkUpdateState
