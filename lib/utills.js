const fs = require("fs-extra");
const nodePath = require("path");
const axios = require("axios").default;
const chalk = require("chalk");
const ora = require("ora");

function getDirsFromPath(path) {
  const { readdirSync, statSync } = fs;
  const { join } = nodePath;
  return readdirSync(path).filter((f) => statSync(join(path, f)).isDirectory() && f[0] !== ".");
}

function checkVersion(version) {
  const currentNodeVersion = process.versions.node;
  const semver = currentNodeVersion.split(".");
  const major = semver[0];
  if (major < version) {
    console.error(`You are running Node ${currentNodeVersion}
Templace Cli requires Node ${version} or higher
Please update your version of Node`);
    process.exit(1);
  }
}

function initConfig(reset = false) {
  try {
    const homePath = require("os").homedir();
    const configName = "template-cli-config.json";
    const configPath = `${homePath}/.${configName}`;
    const originConfigPath = nodePath.resolve(__dirname, `../config.json`);

    if (!fs.existsSync(configPath) || reset) {
      fs.copyFileSync(originConfigPath, configPath);
    }

    process.templateCli = {
      config: require(configPath),
      configPath,
      configFolder: homePath,
    };
  } catch (err) {
    console.error("Template Cli Config init failed");
    process.exit(1);
  }
}

function getLocalTemplatesData(path = "") {
  const cliConfig = process.templateCli.config;
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
  const cliConfig = process.templateCli.config;
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
            `Please configure Github Token, otherwise the number of Api requests will be limited by Github`
          )
        );
        console.log();
      }
      spinner = ora("Fetching templates from Github").start();
      const promises = githubConfigs.map((item) => {
        const config = { ...item, token: githubToken };
        return fetchTemplatesFromGithub(config);
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

async function fetchTemplatesFromGithub(config, url) {
  try {
    const { owner, repo, path, token, type } = config;
    const baseUrl = url || `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await axios.get(baseUrl, {
      timeout: 10000,
      headers: token && {
        Authorization: `token ${token}`,
      },
    });
    if (res.status === 200) {
      const data = res.data || [];
      const templatesData = data.reduce((pre, cur) => {
        if (cur.type === "dir") {
          const item = {
            name: cur.name,
            path: cur.path,
            url: cur.url,
            htmlUr: cur.html_url,
            type,
            config,
          };
          pre.push(item);
        }
        return pre;
      }, []);
      const promises = templatesData.map((item) => {
        return new Promise((resolve, reject) => {
          if (!url) {
            fetchTemplatesFromGithub(config, item.url)
              .then((res) => {
                item.templates = res;
                resolve();
              })
              .catch(reject);
          } else {
            resolve();
          }
        });
      });
      await Promise.all(promises);
      return templatesData;
    } else {
      throw new Error(`fetchTemplatesFromGithub: ${res.data.message}`);
    }
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error(`A timeout happend on fetching templates from Github`);
    } else if (err.response) {
      throw new Error(`fetchTemplatesFromGithub error: ${err.response.data.message}`);
    } else {
      throw err;
    }
  }
}

async function downloadTemplateFromGithub(targetPath, config, url) {
  try {
    const { owner, repo, path, token } = config;
    const baseUrl = url || `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await axios.get(baseUrl, {
      timeout: 10000,
      headers: token && {
        Authorization: `token ${token}`,
      },
    });
    if (res.status === 200) {
      const data = res.data || [];
      const promises = data.map((item) => {
        const realPath = path ? item.path.split(`${path}/`)[1] : item.path;
        return new Promise((resolve, reject) => {
          if (item.download_url && item.type === "file") {
            axios
              .get(item.download_url, { responseType: "stream" })
              .then((res) => {
                const writer = fs.createWriteStream(`${targetPath}/${realPath}`);
                let error = null;
                res.data.pipe(writer);
                writer.on("error", (err) => {
                  error = err;
                  writer.close();
                  reject(err);
                });
                writer.on("close", () => {
                  if (!error) {
                    resolve();
                  }
                });
              })
              .catch(reject);
          } else if (item.type === "dir") {
            fs.mkdirSync(`${targetPath}/${realPath}`);
            downloadTemplateFromGithub(targetPath, config, item.url).then(resolve).catch(reject);
          } else {
            resolve();
          }
        });
      });
      await Promise.all(promises);
    } else {
      throw new Error(`downloadTemplateFromGithub: ${res.data.message}`);
    }
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error(`A timeout happend on download templates from Github`);
    } else if (err.response) {
      throw new Error(`downloadTemplateFromGithub error: ${err.response.data.message}`);
    } else {
      throw err;
    }
  }
}

module.exports = {
  getDirsFromPath,
  checkVersion,
  initConfig,
  getLocalTemplatesData,
  getRemoteTemplatesData,
  fetchTemplatesFromGithub,
  downloadTemplateFromGithub,
};
