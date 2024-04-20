const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");
const fs = require("fs");

const templateBase = path.join(__dirname, "./template");
const crxBase = path.join(__dirname, "./tampermonkey_crx");

async function injectCode({ port, autoRefresh }) {
  autoRefresh = autoRefresh ?? "part";
  const result = await ejs.renderFile(templateBase + "/backgroundInject.js", {
    openPage: "127.0.0.1:" + port,
    socketURL: "127.0.0.1:" + port,
    autoRefresh: autoRefresh,
  });
  fs.writeFileSync(path.join(crxBase, "/backgroundInject.js"), result);
}
async function openBroswer({autoClose}) {
  autoClose = autoClose ?? true;
  const pathToExtension = crxBase;
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
  if (autoClose) {
    browser.on("disconnected", () => {
      console.log("watch close");
      process.exit(1);
    });
  }
}

async function init(options) {
  await injectCode(options);
  await openBroswer(options);
}

exports.init = init;
