const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "version.json");

try {
  const count = execSync("git rev-list --count HEAD", { encoding: "utf-8" }).trim();
  const date = execSync('git log -1 --format=%cd --date=short', { encoding: "utf-8" }).trim();

  const data = { version: `0.${parseInt(count) + 1}`, date };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Version: ${data.version}, Date: ${data.date}`);
} catch (e) {
  console.error("Git failed, using fallback:", e.message);
  const today = new Date().toISOString().slice(0, 10);
  const data = { version: "0.0", date: today };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Fallback Version: ${data.version}, Date: ${data.date}`);
}
