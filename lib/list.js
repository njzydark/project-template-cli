const { getLocalTemplatesData, getRemoteTemplatesData } = require("../lib/utills");

module.exports = async function list(options) {
  const { local, remote } = options;
  let localTemplatesData = [];
  let remoteTemplatesData = [];
  if (local) {
    localTemplatesData = getLocalTemplatesData();
  } else if (remote) {
    remoteTemplatesData = await getRemoteTemplatesData();
  } else {
    localTemplatesData = getLocalTemplatesData();
    remoteTemplatesData = await getRemoteTemplatesData();
  }
  const allTemplatesData = [...localTemplatesData, ...remoteTemplatesData];
  allTemplatesData.forEach((item, index) => {
    item._name = item.name;
    item.value = index;
    item.name = `${item.name} (${item.type ? `${item.type}-${item.config.owner}/${item.config.repo}` : "local"})`;
  });
  console.log();
  allTemplatesData.map((item) => {
    console.log(item.name);
    item.templates.map((item) => {
      console.log(`  ${item.name}`);
    });
  });
};
