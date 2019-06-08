const cron = require("node-cron");
const shell = require("./child_helper.js");
const chalk = require("chalk");
const inquirer = require("inquirer");

// set the title of the command line
const setTitle = require("node-bash-title");

// run schedule every midnight
function runShedule(command) {
  console.log("Application it will run every midnight...");
  cron.schedule("0 0 0 * * *", () => {
    console.log(chalk.blue("schedule run started : ", command));
    shell.series(command, function(err) {
      // console.log('executed many commands in a row');
      console.log("done!");

      if (err) {
        console.log("Erro occured!!!!");
      }
    });
  });
}

// run command in the terminal
function runCommand(cmd) {
  // cmd = ["node wix-code-mls make-config"]
  console.log(chalk.blue("running now", cmd));
  shell.series(cmd, function(err) {
    console.log("completed!");

    if (err) {
      console.log("Erro occured!!!!");
    }
  });
}

async function askMCQ(ques, choice) {
  var { name } = await inquirer.prompt([
    {
      type: "list",
      name: "name",
      message: ques,
      choices: choice
    }
  ]);
  return name;
}

async function askQues(ques) {
    var { name } = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: ques
      }
    ]);
    return name;
  }

module.exports = {
    "setTitle" : setTitle,
    "runShedule" : runShedule,
    "runCommand": runCommand,
    "askMCQ": askMCQ,
    "askQues" : askQues
}