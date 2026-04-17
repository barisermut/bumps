"use strict";

/** @param {string} text */
function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}

function checkAgentInstalled() {
  const { spawnSync } = require("child_process");
  const r = spawnSync("agent", ["--version"], {
    stdio: "ignore",
    timeout: 3000,
  });
  if (r.error && r.error.code === "ENOENT") return false;
  return r.status === 0;
}

function checkAgentLoggedIn() {
  const { spawnSync } = require("child_process");
  const r = spawnSync("agent", ["whoami"], {
    encoding: "utf8",
    timeout: 5000,
  });
  const stdout = r.stdout || "";
  if (r.error && r.error.code === "ENOENT") {
    return { loggedIn: false, email: "" };
  }
  if (r.status !== 0) {
    return { loggedIn: false, email: "" };
  }
  if (stdout.includes("Not logged in")) {
    return { loggedIn: false, email: "" };
  }
  const email = extractEmail(stdout);
  return { loggedIn: true, email };
}

function getMentorState() {
  const installed = checkAgentInstalled();
  const { loggedIn, email } = checkAgentLoggedIn();
  const ready = installed && loggedIn;
  return { installed, loggedIn, email, ready };
}

module.exports = {
  checkAgentInstalled,
  checkAgentLoggedIn,
  getMentorState,
};
