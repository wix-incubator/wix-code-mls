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
let itemsRemoved = 0;
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

module.exports.removedItems = function(number) {
  itemsRemoved += number;
};

module.exports.print = function() {
  const logger = Logger;
  logger.log('statistics');
  const time = new Date().getTime() - start.getTime();
  logger.log('  running time     :', `${logger.formatTime(time)}`);
  logger.log('  -----------------');
  logger.log('  new items        :', newItems);
  logger.log('  update items     :', needUpdate);
  logger.log('  unchanged items  :', unchangedItems);
  logger.log('  removed items    :', itemsRemoved);
  logger.log('  uploaded images  :', uploadedImaged);
  logger.log('  -----------------');
  logger.log('  batches stared   :', batchesStarted);
  logger.log('  batches completed:', batchesCompleted);
  logger.log('  -----------------');
  logger.log('  sync items error :', errorSyncingItems);
  logger.log('  batches failed   :', batchesFailed);
  logger.log('  failed uploads   :', failedToUploadImages);
}