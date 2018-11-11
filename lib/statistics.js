const Logger = require('./logger');


let uploadedImaged = 0;
let failedToUploadImages = 0;
let needUpdate = 0;
let newItems = 0;
let errorSyncingItems = 0;
let unchangedItems = 0;
let batchesStarted = 0;
let batchesCompleted = 0;
let batchesFailed = 0;
let start = new Date();

module.exports.uploadedImage = function() {
  uploadedImaged++;
};

module.exports.failedToUploadImage = function() {
  failedToUploadImages++
};

module.exports.addNeedUpdate = function() {
  needUpdate++;
};

module.exports.addNewItem = function() {
  newItems++
};

module.exports.errorSyncingItem = function() {
  errorSyncingItems++
};

module.exports.addUnchangedItem = function() {
  unchangedItems++;
};

module.exports.batchStarted = function() {
  batchesStarted++;
};

module.exports.batchCompleted = function() {
  batchesCompleted++;
};

module.exports.batchFailed = function() {
  batchesFailed++
};

module.exports.print = function() {
  const logger = Logger;
  logger.log('statistics');
  const time = new Date().getTime() - start.getTime();
  const hours = Math.floor(time/1000/60/60);
  const minutes = Math.floor((time - hours*1000*60*60) / 1000/60);
  const seconds = Math.floor((time - hours*1000*60*60 - minutes*1000*60) / 1000);
  logger.log('  running time     :', `${hours}:${minutes}:${seconds}`);
  logger.log('  items need update:', needUpdate);
  logger.log('  new items        :', newItems);
  logger.log('  unchanged items  :', unchangedItems);
  logger.log('  sync items error :', errorSyncingItems);
  logger.log('  batches stared   :', batchesStarted);
  logger.log('  batches completed:', batchesCompleted);
  logger.log('  batches failed   :', batchesFailed);
  logger.log('  uploaded images  :', uploadedImaged);
  logger.log('  failed uploads   :', failedToUploadImages);
}