const clientSettings = require("./mls-josh-credentials").clientSettings;
const credentials = require('./media-manager-credentials').credentials;

const mlsMetadata = require('./lib/sync-mls').mlsMetadata;
const syncMLS = require('./lib/sync-mls').syncMLS;
const makeRetsConfig = require('./lib/sync-mls').makeRetsConfig;
const tablesConfig = require('./rets.config.json');
const checkUpdateState = require('./lib/wix-sync').checkUpdateState;
const batchCheckUpdateState = require('./lib/wix-sync').batchCheckUpdateState;
const saveItem = require('./lib/wix-sync').saveItem;

// mlsMetadata({
//   retsUrl: clientSettings.loginUrl,
//   retsUser: clientSettings.username,
//   retsPass: clientSettings.password
// });

// makeRetsConfig({
//   retsUrl: clientSettings.loginUrl,
//   retsUser: clientSettings.username,
//   retsPass: clientSettings.password
// });

syncMLS({
    retsUrl: clientSettings.loginUrl,
    retsUser: clientSettings.username,
    retsPass: clientSettings.password
  },
  credentials,
  {
    metasiteId: 'a705d72b-82c5-4920-9ef5-1d8f6c50fd39',
    userId: 'c569b3d3-4d9b-4196-83ca-bb69f6d5684d'
  },
  {
    secret: 'xxxx-xxxx-xxxx',
    checkUpdateState: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/checkUpdateState',
    batchCheckUpdateState: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/batchCheckUpdateState',
    batchCheckUpdateState2: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/batchCheckUpdateState2',
    saveItem: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/saveItem',
    clearStale: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/clearStale'
  },
  tablesConfig
);


// saveItem({data: 1, name: 'wefwe', date: new Date()},
//   {
//     secret: 'xxxx-xxxx-xxxx',
//     checkUpdateState: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/checkUpdateState',
//     saveItem: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/saveItem'
//   },"Properties", "name")
//   .then(res => {
//     console.log(res)
// })
//   .catch(e => {console.log('error', e)});


// checkUpdateState({data: 1, name: 'wefwe', date: new Date()},
//   {
//     secret: 'xxxx-xxxx-xxxx',
//     checkUpdateState: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/checkUpdateState',
//     syncItem: ''
//   },
//   "Properties",
//   "name",
//   "date"
//   ).then(res => {
//     console.log(res)
// })
//   .catch(e => {console.log('error', e)});

// batchCheckUpdateState([{id: '262180216', L_ListingDate: new Date()},
//     {id: '262178254', L_ListingDate: new Date(new Date().getTime() - 1000000000000)},
//     {id: '000', L_ListingDate: new Date()}],
//   {
//     secret: 'xxxx-xxxx-xxxx',
//     checkUpdateState: 'https://yoav68.wixsite.com/mls-rets/_functions-dev/batchCheckUpdateState',
//     syncItem: ''
//   },
//   "Properties",
//   "id",
//   "L_ListingDate"
//   ).then(res => {
//     console.log(res)
// })
//   .catch(e => {console.log('error', e)});