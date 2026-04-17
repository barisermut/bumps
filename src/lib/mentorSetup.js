"use strict";

const { spawn } = require("child_process");

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("child_process").SpawnOptions} options
 * @returns {Promise<boolean>}
 */
function spawnExitOk(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, options);
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

function installAgent() {
  return spawnExitOk("bash", ["-lc", "curl https://cursor.com/install -fsS | bash"], {
    stdio: "inherit",
  });
}

function loginAgent() {
  return spawnExitOk("agent", ["login"], { stdio: "inherit" });
}

module.exports = {
  installAgent,
  loginAgent,
};
