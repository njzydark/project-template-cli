const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const ora = require("ora");
const { getDirsFromPath } = require("../lib/utills");
const chalk = require("chalk");
const shell = require("shelljs");
const cliConfig = require("../template-cli-config.json");

module.exports = async function init(projectName, options) {
  try {
    if (!projectName) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "projectName",
          message: "Input project name",
        },
      ]);
      projectName = answers.projectName;
    }
    const projectDir = `${process.cwd()}/${projectName}`;
    if (fs.existsSync(projectDir)) {
      console.log();
      console.log(chalk.redBright(`This ${projectName} project already exists in the current directory`));
      process.exit(1);
    }
    const templateTypes = getDirsFromPath(path.resolve(__dirname, "../templates"));
    if (templateTypes.length === 0) {
      console.log(chalk.gray("No template type"));
      process.exit(1);
    }
    let templateType = options.templateType;
    if (!templateTypes.includes(templateType)) {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "templateType",
          message: "Choose template type",
          choices: templateTypes,
        },
      ]);
      templateType = answers.templateType;
    }
    let templateName = options.templateName;
    const templateNames = getDirsFromPath(path.resolve(__dirname, `../templates/${templateType}`));
    if (templateNames.length === 0) {
      console.log(chalk.gray("No template"));
      process.exit(1);
    }
    if (!templateNames.includes(templateName)) {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "templateName",
          message: `Choose ${templateType} template`,
          choices: templateNames,
        },
      ]);
      templateName = answers.templateName;
    }
    const templateDir = path.resolve(__dirname, `../templates/${templateType}/${templateName}`);
    await createProject(projectDir, templateDir);
    await installDependcenies(projectDir, projectName);
    console.log();
    console.log(chalk.greenBright(`🎉 The ${chalk.yellow(projectName)} project init successful`));
    openWithEditor(projectDir);
  } catch (err) {
    console.log();
    console.log(chalk.redBright(`The ${chalk.yellow(projectName)} project init failed: ${err.message}`));
    process.exit(1);
  }
};

function createProject(projectDir, templateDir) {
  return new Promise((resolve) => {
    const spinner = ora("Copying files").start();
    fs.copy(templateDir, projectDir)
      .then(() => {
        spinner.succeed("Copy successful");
        resolve();
      })
      .catch((err) => {
        spinner.fail(`Copy filed: ${err.message}`);
        process.exit(1);
      });
  });
}

async function installDependcenies(projectDir, projectName) {
  const hasPackageJsonFile = fs.existsSync(path.join(projectDir, "package.json"));
  const hasNodeModulesDir = fs.existsSync(path.join(projectDir, "node_modules"));
  if (hasPackageJsonFile && !hasNodeModulesDir) {
    let { npmDependeniesInstall } = cliConfig;
    let needInstall = npmDependeniesInstall.auto;
    if (!needInstall) {
      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "needInstall",
          message: `Need to install dependencies`,
          default: true,
        },
      ]);
      needInstall = answers.needInstall;
    }
    if (needInstall) {
      return new Promise((resolve) => {
        if (npmDependeniesInstall.silent) {
          const spinner = ora("Installing dependencies").start();
          require("child_process").exec(`cd ${projectName} && npm i`, (err) => {
            if (!err) {
              spinner.succeed("Dependencies installed successfully");
              resolve();
            } else {
              spinner.fail("Dependencies installed failed");
              process.exit(1);
            }
          });
        } else {
          console.log();
          console.log(chalk.greenBright("📦 Installing dependencies"));
          console.log();
          require("child_process").execSync(`cd ${projectName} && npm i`, { stdio: "inherit" });
          resolve();
        }
      });
    }
  }
}

function openWithEditor(projectDir) {
  const { editorOpen } = cliConfig;
  if (editorOpen.enable) {
    console.log();
    const spinner = ora(`Opening with ${editorOpen.name}`).start();
    shell.exec(`${editorOpen.command} ${projectDir}`, { silent: true }, function (code) {
      if (code === 0) {
        spinner.succeed(`Opening with ${editorOpen.name} successfully`);
        process.exit(1);
      } else {
        spinner.fail(`Opening with ${editorOpen.name} failed`);
        process.exit(1);
      }
    });
  }
}
