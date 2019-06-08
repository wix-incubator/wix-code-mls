const fs = require("fs");
const chalk = require("chalk");
let cmd = require("./command_line");

let { setTitle, runShedule, runCommand, askMCQ, askQues } = cmd;

(async function init() {
  // check for integration folder
  createDir("Integration")
  
  let integrations = fs.readdirSync("./Integration");
  run(integrations);

})();

async function run(integrations) {
  // let integrations = fs.readdirSync("./Integration");
  // console.log(integrations);
  let setting = "setup integration";

  if (integrations && integrations.length > 0) {
    integrations = integrations.filter(el => el[0] !== ".");
    integrations.unshift(setting);
  } else {
    integrations = [setting];
  }
  console.log(chalk.green("INTEGRATION LIST :"));
  // console.log(integrations);
  let getInt = await askMCQ("Select an integration? : ", integrations);

  if (getInt === setting) {
    setIntegration();
    return;
  }
  console.log(`Starting ${getInt} integration.`);

  console.log(chalk.green("SITE LIST : "));

  // ask for which site
  let site = fs.readdirSync("./Integration/" + getInt);
  site = site.filter(el => el !== "schema.json" && el[0] !== ".");

  let getSite = await askMCQ("Select a site : ", site);

  let now = (await askMCQ("Run now?", ["yes", "no"])) === "yes";

  let command = `node wix-code-mls run -c Integration/${getInt}/${getSite}/conf.json -s Integration/${getInt}/schema.json -r Property`;
  setTitle(`${getInt} integration for ${getSite} site`);
  if (now) {
    let title = "running now - " + getSite + " for " + getInt + " Integration.";
    console.log(title);
    // runShedule([command]);
    runCommand([command]);
  } else {
    console.log("schedule - " + getSite + " site for midnight.");

    runShedule([command]);
  }
}

async function setIntegration() {
  let ans = [
    "1. Create a new integration",
    "2. Make config file for a site",
    "3. Make schema file for an integration"
  ]
  let setup = await askMCQ("What do you want to do?", ans);
  let step = setup[0];
  if(step === "1"){
    newIntegration();
  } else if(step ==="2"){
    makeConf();
  } else {
    makeSchema();
  }
}
async function newIntegration() {
  // create a config file
  // create a schema file
  // Integration Name
  // Site Name

  let setInt = await askQues("Type in integration Name (Texas, New york) :");
  console.log(setInt);
  createDir("Integration/" + setInt);
  let setSite = await askQues("Type in site name ");
  createDir(`Integration/${setInt}/${setSite}`);
  makeConf(`Integration/${setInt}/${setSite}`);
}
async function createDir(DirName) {
  return fs.existsSync(DirName) || fs.mkdirSync(DirName, { recursive: true });
}

async function makeConf(siteDir) {
  // let intDir = siteDir.split("/").pop().join("/");
  // let command;

  if(!siteDir) {
    siteDir = await getSiteDir();
  }
  let command = `node wix-code-mls make-config -o ${siteDir}/conf.json`;
  
  await runCommand([command]);
}


async function makeSchema(siteDir) {
  // let intDir = siteDir.split("/").pop().join("/");
  // let command;

  if(!siteDir) {
    siteDir = await getSiteDir();
  }
  console.log(siteDir);
  let intDir = siteDir.split("/");
  intDir.pop();
  intDir = intDir.join("/")
  let command = `node wix-code-mls make-schema -c ${siteDir}/conf.json -o ${intDir}/schema.json`;
  
  await runCommand([command]);
}

async function getSiteDir() {
  let integrations = fs.readdirSync("./Integration");
    if(!integrations && integrations.length === 0) {
      console.log("no integration found.\nCreate a new integration first.");
      return;
    }
    console.log(chalk.green("INTEGRATION LIST :"));
    // console.log(integrations);
    let getInt = await askMCQ("Select an integration? : ", integrations);
    console.log(chalk.green("SITE LIST : "));

    // ask for which site
    let site = fs.readdirSync("./Integration/" + getInt);
    site = site.filter(el => el !== "schema.json" && el[0] !== ".");
  
    let getSite = await askMCQ("Select a site : ", site);
    
    if(!getSite && getSite.length === 0) {
      console.log("no site found!.\n Creata a new integration")
    }
    siteDir = `Integration/${getInt}/${getSite}`;
    return siteDir;
}