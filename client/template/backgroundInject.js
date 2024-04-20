window.openPage = `http://<%= openPage %>`;
var socket = io("http://<%= socketURL %>");
const autoRefresh = "<%= autoRefresh %>";

const scriptSaveName = "scriptSaveName";

const tabsCreate = chrome.tabs.create;
const tabsRemovce = chrome.tabs.remove;

chrome.tabs.remove = function (id, callback, ...args) {
  if (id === -1) {
    return;
  }
  const result = tabsRemovce.call(this, id, callback, ...args);
  return result;
};

chrome.tabs.create = function (obj, callback, ...args) {
  const url = obj.url;
  if (url.indexOf("ask.html?") !== -1) {
    const uuid = url.split("aid=")[1];

    allowAskCom(uuid);

    //pass hook
    callback({
      id: -1,
    });
    return undefined;
  }
  const result = tabsCreate.call(this, obj, callback, ...args);
  return result;
};

const extensionId = chrome.runtime.id;
const fakeMessageSender = `{"id":"${extensionId}","url":"chrome-extension://${extensionId}/options.html#url=&nav=dashboard","origin":"chrome-extension://${extensionId}","frameId":0,"documentId":"C63D1E46F86D9C8F82B2F177F936276A","documentLifecycle":"active","tab":{"active":true,"audible":false,"autoDiscardable":true,"discarded":false,"favIconUrl":"","groupId":-1,"height":702,"highlighted":true,"id":497604263,"incognito":false,"index":3,"lastAccessed":1713028897669.912,"mutedInfo":{"muted":false},"openerTabId":497604260,"pinned":false,"selected":true,"status":"complete","title":"<新建用户脚本>","url":"chrome-extension://${extensionId}/options.html#nav=new-user-script+editor","width":1036,"windowId":497604257},"extpage":"options"}`;

function getScriptData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([scriptSaveName], function (result) {
      if (result[scriptSaveName] === undefined) {
        resolve({});
      } else {
        resolve(JSON.parse(result[scriptSaveName]));
      }
    });
  });
}

function allowAskCom(uuid) {
  const form = {
    method: "askCom",
    data: {
      aid: uuid,
      message: undefined,
      method: "install",
    },
  };
  const sender = JSON.parse(fakeMessageSender);
  chrome.runtime.onMessage.dispatch(form, sender, (response) => {
    console.log("response", response);
  });
}

async function setTMScript(uuid = "new-user-script", scriptContent) {
  return new Promise((resolve, reject) => {
    const isCreated = uuid === "new-user-script";
    const sender = JSON.parse(fakeMessageSender);
    if (!isCreated) {
      sender.tab.url =
        "chrome-extension://${extensionId}/options.html#nav=" +
        uuid +
        "+editor";
    }
    chrome.runtime.onMessage.dispatch(
      {
        auto_save: undefined,
        clean: false,
        code: scriptContent,
        force: undefined,
        lastModTime: isCreated ? undefined : new Date().getTime(),
        method: "saveScript",
        new_script: isCreated ? true : false,
        reload: true,
        restore: undefined,
        uuid: uuid,
      },
      sender,
      (response) => {
        if (response.uuid !== undefined) {
          //成功
          resolve({ uuid: response.uuid });
        } else {
          if (response.installed) {
            resolve({ uuid: uuid });
          } else if (
            response?.messages?.errors !== undefined &&
            response.messages.errors.length !== 0
          ) {
            reject(response.messages.errors[0]);
          } else {
            reject("unknow error");
          }
        }
      }
    );
  });
}

function refreshTabs() {
  chrome.tabs.query({}, function (tabs) {
    for (let index = 0; index < tabs.length; index++) {
      const tab = tabs[index];
      chrome.browserAction.getBadgeText(
        {
          tabId: tab.id,
        },
        (id) => {
          if (autoRefresh === "all" || (id !== undefined && id !== "")) {
            chrome.tabs.reload(tab.id);
          }
        }
      );
    }
    console.log(tabs);
  });
}

async function init() {
  const scriptData = await getScriptData();
  socket.on("saveScript", (name, scriptContent) => {
    console.log("saveScript", name, scriptContent);
    setTMScript(scriptData[name], scriptContent)
      .then(({ uuid }) => {
        scriptData[name] = uuid;
        socket.emit("saveScriptResult", "success", name);
        if (autoRefresh === "part" || autoRefresh === "all") {
          refreshTabs();
        }
      })
      .catch((message) => {
        socket.emit("saveScriptResult", "failed", name, message);
      });
  });
}
init();
