# wix-code-mls
Wix Code MLS integration using the RETS protocol

## How it works

The Intergation is a node.js process (the Integration Server) that runs on your own host, using cron or a similar scheduler. 
When triggered, it connects to the MLS server using the RETS protocol, connects to the Wix Code website using HTTP Functions and starts syncing data.

![System diagram](images/diagram.png)

The actual data sync is done per MLS Table (MLS Resource & Class) to a Wix Code collection as specified in the schema file.
For each table, the integration reads all the items from the MLS server and tries to find those items in the Wix Code collection. 
For any found item, a hash of the item is compared to check if the item needs an update. 

Items that do not need an update are re-saved in the Wix Code collection to update their _updatedDate field.
For items that have a different hash, or do not exist in the Wix Code collection, the integration loads the item images and 
saves the item to the Wix Code collection. 

Once all items that exist on the MLS server are saved or have their _updatedDate updated in the Wix Code collection, the sync 
finds all items in the Wix Code collection that are older then 3 days and removed them.

## Prerequisites

## Setup
