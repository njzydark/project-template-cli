const path = require("path");
const chalk = require("chalk");
const { getDirsFromPath } = require("../lib/utills");

module.exports = async function list(templateType, options) {
  const templateTypes = getDirsFromPath(path.resolve(__dirname, "../templates"));
  if (options.all) {
    console.log(chalk.gray("All templates"));
    console.log();
    consoleTemplateType(templateTypes, true);
  } else if (!templateTypes.includes(templateType)) {
    console.log(chalk.gray(`All template types`));
    consoleTemplateName.log();
    consoleTemplateType(templateTypes);
  } else {
    console.log(chalk.gray(`All ${templateType} templates`));
    console.log();
    consoleTemplateName(templateType);
  }
};

function consoleTemplateType(templateTypes, isConsoleTemplateName = false) {
  templateTypes.forEach((templateType) => {
    console.log(templateType);
    if (isConsoleTemplateName) {
      consoleTemplateName(templateType, "  ");
    }
  });
}

function consoleTemplateName(templateType, prefix = "") {
  const templateNames = getDirsFromPath(path.resolve(__dirname, `../templates/${templateType}`));
  templateNames.forEach((templateName) => {
    console.log(prefix + templateName);
  });
}
