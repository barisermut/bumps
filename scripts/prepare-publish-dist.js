#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "dashboard", "dist");
const dest = path.join(__dirname, "..", "publish-dist");

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      copyRecursive(path.join(from, name), path.join(to, name));
    }
  } else {
    fs.copyFileSync(from, to);
  }
}

rmrf(dest);
copyRecursive(src, dest);
