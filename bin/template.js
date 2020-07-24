#!/usr/bin/env node

const pkg = require("../package.json");
const { program } = require("commander");
const figlet = require("figlet");
const { clear } = require("console");
const utils = require("../lib/utills");

clear();

utils.checkVersion(10);
utils.initConfig();

console.log(figlet.textSync("Project Template"));
console.log(pkg.description);
console.log();

program.version(pkg.version, "-v,--version");

program
  .command("init [projectName]")
  .option("-t,--template-type <templateType>")
  .option("-n,--template-name <templateName>")
  .description("init project from template")
  .action(require("../lib/init"));

program
  .command("list")
  .option("-l,--local", "list local templates")
  .option("-r,--remote", "list remote templates")
  .description("list all templates")
  .action(require("../lib/list"));

program
  .command("config")
  .option("-s,--show", "show config in explorer")
  .option("-o,--open", "open config")
  .option("-r,--reset", "reset config")
  .description("operating config")
  .action(require("../lib/config"));

program.parse(process.argv);
