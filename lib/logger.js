import chalk from 'chalk';
import fs from 'fs';
import PromiseWritable from 'promise-writable';

const start = new Date().getTime();

function time() {
  return new Date().getTime() - start;
}

function logMaker(color) {
  return function (...args) {
    let message = args.map(_ => _?_.toString():'').join(' ');
    console.log(color(formatTime(time())), '  ', color(message));
  }
}

function formatTime(timeMillis) {
  const hours = Math.floor(timeMillis/1000/60/60);
  const minutes = Math.floor((timeMillis - hours*1000*60*60) / 1000/60);
  const seconds = Math.floor((timeMillis - hours*1000*60*60 - minutes*1000*60) / 1000);
  return `${hours}:${minutes}:${seconds}`;
}

let auditWriteStream;
function openAuditLog(filename) {
  const stream = fs.createWriteStream(filename);
  auditWriteStream = new PromiseWritable(stream);
}

async function closeAuditLog() {
  await auditWriteStream.end();
}

async function auditLog(text) {
  if (auditWriteStream)
    await auditWriteStream.write(text + '\n');
}

const logger = {
  log: logMaker(chalk.white),
  error: logMaker(chalk.red),
  warn: logMaker(chalk.yellow),
  trace: logMaker(chalk.gray),
  strong: logMaker(chalk.whiteBright),
  yellow: logMaker(chalk.yellow),
  strongGreen: logMaker(chalk.greenBright),
  formatTime: formatTime,
  auditLog: auditLog,
  openAuditLog: openAuditLog,
  closeAuditLog: closeAuditLog
};

export default logger;