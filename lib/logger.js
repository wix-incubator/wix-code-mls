const chalk = require('chalk');

const start = new Date().getTime();

function time() {
  return new Date().getTime() - start;
}

function logMaker(color) {
  return function (...args) {
    let message = args.map(_ => _.toString()).join(' ');
    console.log(color(time()), color(message));
  }
}

module.exports = {
  log: logMaker(chalk.white),
  error: logMaker(chalk.red),
  trace: logMaker(chalk.gray),
  strong: logMaker(chalk.whiteBright),
  yellow: logMaker(chalk.yellow)
};