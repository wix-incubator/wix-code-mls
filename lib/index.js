import optimist from 'optimist';
import {makeConfig, makeRetsConfig, syncMLS} from './sync-mls';
import logger from './logger'
import fs from 'fs';
import {promisify} from 'util';
const readFile = promisify(fs.readFile);

if (process.argv.length < 3) {
  printUsage();
  process.exit(1);
}

let command = process.argv[2];

if (command === 'make-config') {
  makeConfigCommand();
}
else if (command === 'make-schema') {
  makeSchema();
}
else if (command === 'run') {
  run();
}
else {
  printUsage(1);
  process.exit(1);
}

function printUsage() {
  console.log('Usage: ' + optimist.$0 + ' [command] [options...]');
  console.log('');
  console.log('Commands:');
  console.log('  make-config   generates the basic wix-code-rets config file');
  console.log('  make-schema   generates a schema file describing the RETS server Resources and Classes, \n'+
              '                and how to sync those to a Wix Code website');
  console.log('  run           runs the RETS integration, importing the data into a Wix Code website');
}

async function makeConfigCommand() {
  let argv = optimist
    .usage('Usage: $0 make-config -o [filename]')
    .alias(   'o', 'output')
    .describe('o', 'name of the config file to generate. defaults to conf.json')
    .parse(process.argv.slice(3));

  let filename = argv.output || 'conf.json';

  try {
    await makeConfig(filename);
    logger.strongGreen(`Created config file template at ${filename}`);
    logger.log(`  next steps:`);
    logger.trace(`  1. enter your REST server url, username and password in the generated file`);
    logger.trace(`  2. run wix-code-rests.js make-schema`);
  }
  catch (e) {
    logger.error(`Failed to create config file ${filename} - ${e.message}`)
  }
}

async function makeSchema() {
  let argv = optimist
    .usage('Usage: $0 make-schema -c [config file] -o [filename]')
    .demand(  'c')
    .alias(   'c', 'config')
    .describe('c', 'name of the config file to use')
    .alias(   'o', 'output')
    .describe('o', 'name of the schema file to generate. defaults to schema.json')
    .parse(process.argv.slice(3));

  let configFilename = argv.config;
  let filename = argv.output || 'schema.json';

  try {
    let config = JSON.parse(await readFile(configFilename));
    await makeRetsConfig({
      retsUrl: config.loginUrl,
      retsUser: config.username,
      retsPass: config.password
    }, filename);
    logger.strongGreen(`Created RETS schema file at ${filename}`);
    logger.log(`  next steps:`);
    logger.trace(`  1. in your schema file, update the wixCollection per resource/class`);
    logger.trace(`     to specify into which site collection the data is synced`);
    logger.trace(`  2. in your schema file, update the sync and syncImages resource/class`);
    logger.trace(`     to specify what to sync`);
    logger.trace(`  3. run wix-code-rests.js run`);
  }
  catch (e) {
    logger.error(`Failed to create schema file ${filename} - ${e.message}`)
  }
}

async function run() {
  let argv = optimist
    .usage('Usage: $0 run -c [config file] -s [schema filename]')
    .demand(  'c')
    .alias(   'c', 'config')
    .describe('c', 'name of the config file to use')
    .demand(  's')
    .alias(   's', 'schema')
    .describe('s', 'name of the schema file to use')
    .parse(process.argv.slice(3));

  let configFilename = argv.config;
  let schemaFilename = argv.schema;

  try {
    let config = JSON.parse(await readFile(configFilename));
    let schema = JSON.parse(await readFile(schemaFilename));
    await syncMLS({
      retsUrl: config.loginUrl,
      retsUser: config.username,
      retsPass: config.password
    }, config,
      schema);
    logger.strongGreen(`Completed RETS data sync`);
  }
  catch (e) {
    logger.error(`Failed to create schema file ${filename} - ${e.message}`)
  }
}