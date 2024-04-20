const express = require("express");
const path = require("path");
const http = require("http");
const fs = require("fs-extra");
const { Server } = require("socket.io");
const watch = require("node-watch");

function initLocalServer({ cacheDir } = {}) {
  cacheDir = cacheDir ?? "./.tmCache";
  return new Promise(async (resolve) => {
    const result = await fs.remove(cacheDir);
    await fs.ensureDir(cacheDir);
    const app = express();
    app.use(express.static(path.join(__dirname, "/public")));
    let server = http.createServer(app);
    const io = new Server(server);
    io.on("connection", (socket) => {
      console.log("socket connect");
      socket.on("saveScriptResult", (status, name, message) => {
        if (status === "success") {
          console.log(name + " sync success");
        } else {
          console.warn(
            name +
              " sync failed reason:" +
              (message ?? "").replaceAll(/[\n\s]*$/g, "")
          );
        }
      });
      fs.readdir(cacheDir, (err, files) => {
        files.forEach((file) => {
          sendScriptPath(
            file.replace(".tmcache.js", ""),
            path.join(cacheDir, file),
            {
              noCache: true,
            }
          );
        });
      });
      socket.on("disconnect", () => {
        console.log("user disconnected");
      });
    });
    async function sendScriptContent(unionName, scriptContent, options = {}) {
      if (unionName === undefined) {
        console.warn(unionName + "script unionName is not define");
        return;
      }
      io.emit("saveScript", unionName, scriptContent);
      if (options.noCache !== true) {
        await fs.writeFile(
          cacheDir + "/" + unionName + ".tmcache.js",
          scriptContent
        );
      }
    }
    function sendScriptPath(unionName, scriptPath, options) {
      fs.readFile(scriptPath, (err, data) => {
        if (err) {
          console.warn(unionName + "sendScriptPath read failed");
          return;
        }
        sendScriptContent(
          unionName ?? scriptPath.replaceAll(/.*\\/g, ""),
          data.toString(),
          options
        );
      });
    }

    function watchScriptFile(unionName, filePath) {
      const returnBody = {};
      if (fs.existsSync(filePath)) {
        //file exist first update
        sendScriptPath(unionName, filePath);
        let watcher = watch(filePath, function (evt, name) {
          if (evt == "update") {
            sendScriptPath(unionName, filePath);
          }
          if (evt == "remove") {
          }
        });
        returnBody.close = () => watcher.close();
      } else {
        //downgrade Handle
        const basePath = path.join(filePath, "..");
        const { close } = watchScriptDirection(
          basePath,
          filePath.replaceAll(basePath, ""),
          unionName
        );
        returnBody.close = close;
      }
      return returnBody;
    }
    function watchScriptDirection(direction, fileName, unionNameCallback) {
      let watcher = {
        close: () => {},
      };
      if (fs.existsSync(direction)) {
        const filePath = path.join(direction, fileName);
        if (fs.existsSync(filePath)) {
          sendScriptPath(unionName, filePath);
        }
        watcher = watch(direction, function (evt, name) {
          if (name === fileName) {
            if (evt == "update") {
              const unionName =
                typeof unionNameCallback === "string"
                  ? unionNameCallback
                  : unionNameCallback();
              sendScriptPath(unionName, filePath);
            }
          }
        });
      } else {
        throw new Error("not exist direction");
      }

      return {
        close: () => watcher.close(),
      };
    }
    server.listen(0, () => {
      resolve({
        port: server.address().port,
        sendScriptContent,
        sendScriptPath,
        watchScriptFile,
        watchScriptDirection,
      });
    });
  });
}

exports.initLocalServer = initLocalServer;
