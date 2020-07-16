#!/usr/bin/env node

const pkg = require("../package.json");
const { program } = require("commander");
const figlet = require("figlet");
const { clear } = require("console");

clear();

console.log(figlet.textSync("Template CLI"));
console.log(pkg.description + "\n");

program.version(pkg.version, "-v,--version");

program
  .command("init [projectName]")
  .option("-t,--template-type <templateType>")
  .option("-n,--template-name <templateName>")
  .description("init project from template")
  .action(require("../lib/init"));

program
  .command("list [templateType]")
  .option("-a,--all", "list all templates")
  .description("list template types or names")
  .action(require("../lib/list"));

program.parse(process.argv);
