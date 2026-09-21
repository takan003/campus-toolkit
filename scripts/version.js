const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

try {
  const count = execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim();
  const date = execSync('git log -1 --format=%cd --date=short', { encoding: "utf-8" }).trim();

  const data = { version: `0.${parseInt(count) + 1}`, date };
  const filePath = path.join(__dirname, "..", "src", "version.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Version: ${data.version}, Date: ${data.date}`);
} catch (e) {
  console.error("Failed to generate version:", e);
}
