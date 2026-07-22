const fs = require("node:fs");
const path = require("node:path");

const clientFiles = ["app.js", "tent-app.js", "tent.html", "test.html"];
const forbidden = [/GITHUB_TOKEN/, /GH_TOKEN/, /BUDAO_SESSION_SECRET/, /password\s*:\s*["'][^"']+/];
for (const file of clientFiles) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error("forbidden client secret pattern in " + file);
  }
}
console.log("Static site build check passed; no server secret names or hard-coded passwords in client files.");
