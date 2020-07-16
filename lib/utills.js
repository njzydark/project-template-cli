exports.getDirsFromPath = (path) => {
  const { readdirSync, statSync } = require("fs-extra");
  const { join } = require("path");
  return readdirSync(path).filter((f) => statSync(join(path, f)).isDirectory());
};
