#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const indexHtml = path.join(
  __dirname,
  "..",
  "dashboard",
  "dist",
  "index.html"
);

if (!fs.existsSync(indexHtml)) {
  console.error(
    "getbumps: cannot publish without dashboard/dist.\n" +
      "From the repo root run:\n" +
      "  cd dashboard && npm install && npm run build"
  );
  process.exit(1);
}
