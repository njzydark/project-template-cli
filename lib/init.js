const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const ora = require("ora");
const chalk = require("chalk");
const shell = require("shelljs");

const { getLocalTemplatesData, getAllRemoteTemplatesData, downloadTemplateFromRemote } = require("../lib/utills");

const cliConfig = process.templateCli.config;

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

    const localTemplatesData = getLocalTemplatesData();

    const remoteTemplatesData = await getAllRemoteTemplatesData();

    const allTemplatesData = [...localTemplatesData, ...remoteTemplatesData];
    allTemplatesData.forEach((item, index) => {
      item._name = item.name;
      item.value = index;
      item.name = `${item.name} (${item.type ? `${item.type}-${item.config.owner}/${item.config.repo}` : "local"})`;
    });

    if (allTemplatesData.length === 0) {
      console.log(chalk.gray("No template type"));
      process.exit(1);
    }

    let templateType = options.templateType;
    let templateTypeIndex = allTemplatesData.findIndex((item) => item.name === templateType);
    if (!templateType || templateTypeIndex === -1) {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "templateType",
          message: "Choose template type",
          choices: allTemplatesData,
        },
      ]);
      templateTypeIndex = answers.templateType;
      templateType = allTemplatesData[templateTypeIndex]._name;
    }

    const templates = allTemplatesData[templateTypeIndex].templates;
    if (templates.length === 0) {
      console.log(chalk.gray("No template"));
      process.exit(1);
    }

    let templateName = options.templateName;
    let templateNameIndex = templates.findIndex((item) => item.name === templateName);
    if (!templateName || templateNameIndex === -1) {
      const answers = await inquirer.prompt([
        {
          type: "list",
          name: "templateName",
          message: `Choose ${templateType} template`,
          choices: templates.map((item, index) => {
            item.value = index;
            return item;
          }),
        },
      ]);
      templateNameIndex = answers.templateName;
      templateName = templates[templateNameIndex].name;
    }

    const template = templates[templateNameIndex];
    await createProject(template, projectDir, templateType, templateName);
    await gitInit(projectDir);
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

async function createProject(template, projectDir, templateType, templateName) {
  const repoType = template.type;
  let spinner;
  try {
    if (repoType === "github" || repoType === "gitlab") {
      fs.mkdirSync(projectDir);
      spinner = ora(`Downloading files from ${repoType}`).start();
      template.config.path = template.config.path
        ? `${template.config.path}/${templateType}/${templateName}`
        : `${templateType}/${templateName}`;
      await downloadTemplateFromRemote(repoType, projectDir, template.config);
      spinner.succeed(`Downloading files from ${repoType} successful`);
    } else {
      const spinner = ora("Copying files").start();
      await fs.copy(template.path, projectDir);
      spinner.succeed("Copy successful");
    }
  } catch (err) {
    if (repoType === "github" || repoType === "gitlab") {
      spinner.fail(`Downloading files from ${repoType} failed`);
      console.log();
      console.log(chalk.redBright(err.message));
      fs.rmdirSync(projectDir, { recursive: true });
    } else {
      spinner.fail(`Copy filed: ${err.message}`);
    }
    process.exit(1);
  }
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
          require("child_process").exec(`cd ${projectName} && ${npmDependeniesInstall.manager} install`, (err) => {
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
          require("child_process").execSync(`cd ${projectName} && ${npmDependeniesInstall.manager} install`, {
            stdio: "inherit",
          });
          resolve();
        }
      });
    }
  }
}

function gitInit(projectDir) {
  return new Promise((resolve) => {
    const { git } = cliConfig;
    if (git.init && !fs.existsSync(`${projectDir}/.git`)) {
      const spinner = ora(`Git init`).start();
      let { code } = shell.exec(`cd ${projectDir} && git init`, { silent: true });
      if (code !== 0) {
        spinner.fail(`Git init failed`);
        return resolve();
      }
      if (git.firstCommit) {
        let { code } = shell.exec(`cd ${projectDir} && git add . && git commit -m "${git.firstCommit}"`, {
          silent: true,
        });
        if (code !== 0) {
          spinner.fail(`Git init successful but Git commit failed`);
          return resolve();
        }
      }
      spinner.succeed(`Git init successful`);
      resolve();
    } else {
      resolve();
    }
  });
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
