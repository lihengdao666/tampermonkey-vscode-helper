const server = require("./server/index.js");
const client = require("./client/index.js");
const fs = require("fs-extra");
const path = require("path");

async function init({ autoRefresh, autoClose }) {
  const {
    port,
    sendScriptContent,
    sendScriptPath,
    watchScriptFile,
    watchScriptDirection,
  } = await server.initLocalServer();
  client.init({ port, autoRefresh, autoClose });
  return {
    sendScriptContent,
    sendScriptPath,
    watchScriptFile,
    watchScriptDirection,
  };
}

// init().then(({ watchScriptFile }) => {
//   watchScriptFile("baiduScript", path.join(__dirname, "./test.js"));
// });
exports.init = init;
