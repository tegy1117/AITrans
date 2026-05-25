const fs = require("node:fs");
const path = require("node:path");

const contentScriptPath = path.join(__dirname, "..", "dist", "contentScript.js");
const source = fs.readFileSync(contentScriptPath, "utf8");

if (/^\s*import\s/m.test(source) || /^\s*export\s/m.test(source)) {
  console.error("dist/contentScript.js must be a classic self-contained script without import/export statements.");
  process.exit(1);
}
