const fs = require("fs");
const path = require("path");

/**
 * In a repo clone, prefer dashboard/dist so local rebuilds win.
 * Published installs only ship publish-dist/.
 */
function defaultDashboardPath() {
  const publishDist = path.join(__dirname, "..", "publish-dist");
  const devDist = path.join(__dirname, "..", "dashboard", "dist");
  if (fs.existsSync(path.join(devDist, "index.html"))) return devDist;
  if (fs.existsSync(path.join(publishDist, "index.html"))) return publishDist;
  return devDist;
}

module.exports = { defaultDashboardPath };
