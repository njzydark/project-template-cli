const fs = require("fs-extra");
const nodePath = require("path");
const axios = require("axios").default;
const chalk = require("chalk");
const ora = require("ora");
const qs = require("query-string");

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

async function getAllRemoteTemplatesData() {
  let remoteTemplatesData = [];
  const githubData = await getRemoteTemplatesData("github");
  const gitlabData = await getRemoteTemplatesData("gitlab");
  remoteTemplatesData.push(...githubData, ...gitlabData);
  return remoteTemplatesData;
}

async function getRemoteTemplatesData(repoType = "github") {
  const cliConfig = process.templateCli.config;
  let spinner;
  try {
    let { remoteTemplates = [] } = cliConfig;
    const token = cliConfig[`${repoType}Token`];

    if (remoteTemplates.length === 0) {
      return [];
    }

    const templateConfigs = remoteTemplates.filter((item) => item.type === repoType);

    let remoteTemplatesData = [];

    if (templateConfigs.length > 0) {
      if (!token) {
        console.log(
          chalk.yellowBright(
            `Please configure ${repoType} Token, otherwise the number of Api requests will be limited by ${repoType} and you can't request private repository`
          )
        );
        console.log();
      }
      if (templateConfigs.length > 0) {
        spinner = ora(`Fetching templates from ${repoType}`).start();
      }
      const promises = templateConfigs.map((item) => {
        const config = { ...item, token };
        return fetchTemplatesFromRemote(repoType, config);
      });
      const data = await Promise.all(promises);
      spinner && spinner.succeed(`Fetching templates from ${repoType} successful`);

      remoteTemplatesData = data.reduce((pre, cur) => {
        pre.push(...cur);
        return pre;
      }, []);
      return remoteTemplatesData;
    } else {
      return remoteTemplatesData;
    }
  } catch (err) {
    spinner && spinner.fail(`Fetching templates from ${repoType} failed`);
    console.log(chalk.redBright(err.message));
    console.log();
    return [];
  }
}

async function fetchTemplatesFromRemote(repoType = "github", config, targetUrl) {
  try {
    const cliConfig = process.templateCli.config;
    const { baseUrl = "", owner, repo, branch = "master", path, type } = config;
    const token = cliConfig[`${repoType}Token`];

    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const url =
      targetUrl ||
      (repoType === "github"
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
        : `${baseUrl}/projects/${projectId}/repository/tree?ref=${branch}&per_page=100&path=${path}`);

    const res = await axios.get(url, {
      timeout: 10000,
      headers: token && {
        Authorization: repoType === "github" ? `token ${token}` : `Bearer ${token}`,
      },
    });

    if (res.status === 200) {
      const data = res.data || [];
      const templatesData = data.reduce((pre, cur) => {
        if (cur.type === "dir" || cur.type === "tree") {
          const item = {
            name: cur.name,
            path: cur.path,
            url: cur.url || "",
            htmlUr: cur.html_url || "",
            type,
            config,
          };
          if (repoType === "gitlab") {
            const parseData = qs.parseUrl(url);
            parseData.query.path = cur.path;
            item.url = qs.stringifyUrl(parseData, { encode: false });
          }
          pre.push(item);
        }
        return pre;
      }, []);
      const promises = templatesData.map((item) => {
        return new Promise((resolve, reject) => {
          if (!targetUrl) {
            fetchTemplatesFromRemote(repoType, config, item.url)
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
      throw new Error(`fetchTemplatesFrom${repoType}: ${res.data.message}`);
    }
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error(`A timeout happend on fetching templates from ${repoType}`);
    } else if (err.response) {
      throw new Error(`fetchTemplatesFrom${repoType} error: ${err.response.data.message}`);
    } else {
      throw err;
    }
  }
}

async function downloadTemplateFromRemote(repoType = "github", targetPath, config, targetUrl) {
  try {
    const { baseUrl, owner, repo, branch, path, token } = config;
    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const url =
      targetUrl ||
      (repoType === "github"
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
        : `${baseUrl}/projects/${projectId}/repository/tree?ref=${branch}&per_page=100&path=${path}`);

    const res = await axios.get(url, {
      timeout: 10000,
      headers: token && {
        Authorization: repoType === "github" ? `token ${token}` : `Bearer ${token}`,
      },
    });

    if (res.status === 200) {
      let data = res.data || [];
      if (repoType === "gitlab") {
        data = data.reduce((pre, cur) => {
          if (cur.type === "tree" || cur.type === "blob") {
            const parseData = qs.parseUrl(url);
            parseData.query.path = cur.path;
            const item = {
              name: cur.name,
              path: cur.path,
              url: qs.stringifyUrl(parseData, { encode: false }),
              type: cur.type,
              download_url:
                cur.type === "blob"
                  ? `${baseUrl}/projects/${projectId}/repository/blobs/${cur.id}/raw?ref=${branch}&per_page=100&private_token=${token}`
                  : "",
              config,
            };
            pre.push(item);
          }
          return pre;
        }, []);
      }

      const promises = data.map((item) => {
        const realPath = path ? item.path.split(`${path}/`)[1] : item.path;
        return new Promise((resolve, reject) => {
          if (item.download_url && (item.type === "file" || item.type === "blob")) {
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
          } else if (item.type === "dir" || item.type === "tree") {
            fs.mkdirSync(`${targetPath}/${realPath}`);
            downloadTemplateFromRemote(repoType, targetPath, config, item.url).then(resolve).catch(reject);
          } else {
            resolve();
          }
        });
      });
      await Promise.all(promises);
    } else {
      throw new Error(`downloadTemplateFrom${repoType}: ${res.data.message}`);
    }
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error(`A timeout happend on download templates from ${repoType}`);
    } else if (err.response) {
      throw new Error(`downloadTemplateFrom${repoType} error: ${err.response.data.message}`);
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
  getAllRemoteTemplatesData,
  downloadTemplateFromRemote,
};
