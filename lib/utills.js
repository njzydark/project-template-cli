const fs = require("fs-extra");
const nodePath = require("path");
const axios = require("axios").default;

exports.getDirsFromPath = (path) => {
  const { readdirSync, statSync } = fs;
  const { join } = nodePath;
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

exports.fetchTemplatesFromGithub = async function fetchTemplatesFromGithub(config, url) {
  try {
    const { owner, repo, path, token, type } = config;
    const baseUrl = url || `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await axios.get(baseUrl, {
      timeout: 8000,
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
        return new Promise((resolve) => {
          if (!url) {
            fetchTemplatesFromGithub(config, item.url).then((res) => {
              item.templates = res;
              resolve();
            });
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
};

exports.downloadTemplateFromGithub = async function downloadTemplateFromGithub(targetPath, config, url) {
  try {
    const { owner, repo, path, token } = config;
    const baseUrl = url || `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await axios.get(baseUrl, {
      timeout: 8000,
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
            downloadTemplateFromGithub(targetPath, config, item.url).then(resolve);
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
};
