import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const suspiciousPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{16,}/i,
];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const findings = [];

for (const file of trackedFiles) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      findings.push(`${file}: matched ${pattern}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets found:");
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed (${trackedFiles.length} tracked files checked).`);
