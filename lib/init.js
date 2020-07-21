const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const ora = require("ora");
const { getDirsFromPath, fetchTemplatesFromGithub, downloadTemplateFromGithub } = require("../lib/utills");
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

    const localTemplatesData = getLocalTemplatesData();
    const remoteTemplatesData = await getRemoteTemplatesData();
    const allTemplatesData = [...localTemplatesData, ...remoteTemplatesData];
    allTemplatesData.forEach((item, index) => {
      item._name = item.name;
      item.value = index;
      item.name = `${item.name} (${item.type ? `${item.config.repo}-${item.type}` : "local"})`;
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
  let spinner;
  try {
    if (template.type === "github") {
      fs.mkdirSync(projectDir);
      spinner = ora(`Downloading files from Github`).start();
      template.config.path = `${template.config.path}/${templateType}/${templateName}`;
      await downloadTemplateFromGithub(projectDir, template.config);
      spinner.succeed(`Downloading files from Gtihub successful`);
    } else {
      const spinner = ora("Copying files").start();
      await fs.copy(template.path, projectDir);
      spinner.succeed("Copy successful");
    }
  } catch (err) {
    if (template.type === "github") {
      spinner.fail(`Downloading files from Github failed`);
      console.log();
      console.log(chalk.redBright(err.message));
      fs.rmdirSync(projectDir);
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

function getLocalTemplatesData(path = "") {
  const localTemplatesConfig = cliConfig.localTemplates || [];
  const localTemplatesData = localTemplatesConfig.reduce((pre, cur) => {
    const realPath = path || cur.path;
    const templateNames = getDirsFromPath(realPath);
    const data = templateNames.map((item) => {
      const temp = { name: item, path: `${realPath}/${item}` };
      if (!path) {
        temp.templates = getLocalTemplatesData(temp.path);
      }
      return temp;
    });
    pre.push(...data);
    return pre;
  }, []);
  return localTemplatesData;
}

async function getRemoteTemplatesData() {
  let spinner;
  try {
    let { githubToken = "", remoteTemplates = [] } = cliConfig;
    if (remoteTemplates.length === 0) {
      return [];
    }
    const githubConfigs = remoteTemplates.filter((item) => item.type === "github");
    let remoteTemplatesData = [];
    if (githubConfigs.length > 0) {
      if (!githubToken) {
        console.log(
          chalk.yellowBright(
            `Please configure Github Token, otherwise the number of interface requests will be limited by Github`
          )
        );
        console.log();
      }
      spinner = ora("Fetching templates from Github").start();
      const promises = githubConfigs.map(async (item) => {
        const config = { ...item, token: githubToken };
        return await fetchTemplatesFromGithub(config);
      });
      const data = await Promise.all(promises);
      remoteTemplatesData = data.reduce((pre, cur) => {
        pre.push(...cur);
        return pre;
      }, []);
      spinner && spinner.succeed("Fetching templates from Github successful");
      return remoteTemplatesData;
    } else {
      return remoteTemplatesData;
    }
  } catch (err) {
    spinner && spinner.stop();
    console.log(chalk.redBright(err.message));
    console.log();
    return [];
  }
}
