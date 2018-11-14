import logger from './logger';

class Statistics
{

  constructor() {
    this.needUpdate = 0;
    this.newItems = 0;
    this.errorSyncingItems = 0;
    this.unchangedItems = 0;
    this.batchesStarted = 0;
    this.batchesCompleted = 0;
    this.batchesFailed = 0;
    this.itemsRemoved = 0;
    this.start = new Date();
  }

  addNeedUpdate() {
    this.needUpdate++;
  }

  addNewItem() {
    this.newItems++
  }

  errorSyncingItem() {
    this.errorSyncingItems++
  }

  addUnchangedItem() {
    this.unchangedItems++;
  }

  batchStarted() {
    this.batchesStarted++;
  }

  batchCompleted() {
    this.batchesCompleted++;
  }

  batchFailed() {
    this.batchesFailed++
  }

  removedItems(number) {
    this.itemsRemoved += number;
  }

  print() {
    logger.log('statistics');
    const time = new Date().getTime() - this.start.getTime();
    logger.log('  running time     :', `${logger.formatTime(time)}`);
    logger.log('  -----------------');
    logger.log('  new items        :', this.newItems);
    logger.log('  update items     :', this.needUpdate);
    logger.log('  unchanged items  :', this.unchangedItems);
    logger.log('  removed items    :', this.itemsRemoved);
    logger.log('  -----------------');
    logger.log('  batches stared   :', this.batchesStarted);
    logger.log('  batches completed:', this.batchesCompleted);
    logger.log('  -----------------');
    logger.log('  sync items error :', this.errorSyncingItems);
    logger.log('  batches failed   :', this.batchesFailed);
  }
}

const stats = new Statistics();
export default stats;