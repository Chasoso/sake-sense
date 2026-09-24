import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "backend/data-platform/dist");
const archive = resolve(directory, "data-platform.zip");
if (!existsSync(directory))
  throw new Error("Missing data-platform dist. Run npm run build:data-platform first.");
if (existsSync(archive)) rmSync(archive);
mkdirSync(directory, { recursive: true });
const result = spawnSync("zip", ["-q", "-X", archive, "public-handler.js", "admin-handler.js"], {
  cwd: directory,
  stdio: "inherit",
});
if (result.error && process.platform === "win32") {
  const fallback = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -LiteralPath 'public-handler.js','admin-handler.js' -DestinationPath '${archive}' -Force`,
    ],
    { cwd: directory, stdio: "inherit" },
  );
  if (fallback.error || fallback.status !== 0)
    throw new Error("Unable to create data-platform package");
} else if (result.error || result.status !== 0)
  throw new Error(`zip failed: ${result.error?.message ?? result.status}`);
console.log(`Created ${archive}`);
