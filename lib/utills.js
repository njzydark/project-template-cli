exports.getDirsFromPath = (path) => {
  const { readdirSync, statSync } = require("fs-extra");
  const { join } = require("path");
  return readdirSync(path).filter((f) => statSync(join(path, f)).isDirectory());
};

exports.checkVersion = (version) => {
  const currentNodeVersion = process.versions.node;
  const semver = currentNodeVersion.split(".");
  const major = semver[0];
  if (major < version) {
    console.error(`You are running Node ${currentNodeVersion}
Templace Cli requires Node ${version} or higher
Please update your version of Node`);
    process.exit(1);
  }
};
