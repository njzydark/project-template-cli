const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const ora = require("ora");
const { getDirsFromPath } = require("../lib/utills");
const chalk = require("chalk");
const shell = require("shelljs");

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
      console.log(chalk.redBright(`\nThis ${projectName} project already exists in the current directory`));
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
    console.log(chalk.greenBright(`\n🎉 The ${chalk.yellow(projectName)} project init successful`));
  } catch (err) {
    console.log(chalk.redBright(`\nThe ${chalk.yellow(projectName)} project init failed: ${err.message}`));
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
    const answers = await inquirer.prompt([
      {
        type: "confirm",
        name: "needInstall",
        message: `Need to install dependencies`,
        default: true,
      },
    ]);
    if (answers.needInstall) {
      const spinner = ora("Installing dependencies").start();
      return new Promise((resolve) => {
        shell.exec(`cd ${projectName} && npm i`, { silent: true }, function (code) {
          if (code === 0) {
            spinner.succeed("Dependencies installed successfully");
            resolve();
          } else {
            spinner.fail("Dependencies installed failed");
            process.exit(1);
          }
        });
      });
    }
  }
}
