"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

function cacheDir() {
  if (process.env.BUMPS_MENTOR_CACHE_DIR) {
    return process.env.BUMPS_MENTOR_CACHE_DIR;
  }
  return path.join(os.homedir(), ".cache", "bumps", "mentor");
}

function cachePath(key) {
  return path.join(cacheDir(), `${key}.json`);
}

function ensureDir() {
  fs.mkdirSync(cacheDir(), { recursive: true });
}

function readCache(key) {
  try {
    const p = cachePath(key);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    ensureDir();
    fs.writeFileSync(cachePath(key), JSON.stringify(value), "utf8");
  } catch (err) {
    console.warn("[bumps] mentor cache write failed:", err.message);
  }
}

function existsCached(key) {
  try {
    return fs.existsSync(cachePath(key));
  } catch {
    return false;
  }
}

module.exports = {
  cacheDir,
  cachePath,
  readCache,
  writeCache,
  existsCached,
};
