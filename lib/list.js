const { getLocalTemplatesData, getAllRemoteTemplatesData } = require("../lib/utills");

const SYMBOLS = {
  BRANCH: "├── ",
  EMPTY: "",
  INDENT: "    ",
  LAST_BRANCH: "└── ",
  VERTICAL: "│   ",
};

module.exports = async function list(options) {
  const { local, remote } = options;
  let localTemplatesData = [];
  let remoteTemplatesData = [];
  if (local) {
    localTemplatesData = getLocalTemplatesData();
  } else if (remote) {
    remoteTemplatesData = await getAllRemoteTemplatesData();
  } else {
    localTemplatesData = getLocalTemplatesData();
    remoteTemplatesData = await getAllRemoteTemplatesData();
  }
  const allTemplatesData = [...localTemplatesData, ...remoteTemplatesData];
  allTemplatesData.forEach((item, index) => {
    item._name = item.name;
    item.value = index;
    item.name = `${item.name} (${item.type ? `${item.type}-${item.config.owner}/${item.config.repo}` : "local"})`;
  });
  console.log();
  allTemplatesData.map((item, index) => {
    const isLastParent = index === allTemplatesData.length - 1;
    console.log(`${isLastParent ? SYMBOLS.LAST_BRANCH : SYMBOLS.BRANCH}${item.name}`);
    item.templates.map((cItem, index) => {
      console.log(
        `${isLastParent ? SYMBOLS.EMPTY + SYMBOLS.INDENT : SYMBOLS.VERTICAL}${
          index === item.templates.length - 1 ? SYMBOLS.LAST_BRANCH : SYMBOLS.BRANCH
        }${cItem.name}`
      );
    });
  });
};
