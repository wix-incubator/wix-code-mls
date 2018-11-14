import chalk from 'chalk';

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

const logger = {
  log: logMaker(chalk.white),
  error: logMaker(chalk.red),
  trace: logMaker(chalk.gray),
  strong: logMaker(chalk.whiteBright),
  yellow: logMaker(chalk.yellow),
  strongGreen: logMaker(chalk.greenBright),
  formatTime: formatTime
};

export default logger;