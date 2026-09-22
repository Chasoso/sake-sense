import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const SEMANTIC_BRIDGE_PACKAGE_FILES = ["index.js"];

export function buildZipArguments(archivePath) {
  return ["-q", "-X", archivePath, ...SEMANTIC_BRIDGE_PACKAGE_FILES];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const bundleDirectory = resolve(repositoryRoot, "backend/semantic-bridge/dist");
  const bundlePath = resolve(bundleDirectory, "index.js");
  const archivePath = resolve(bundleDirectory, "index.js.zip");

  if (!existsSync(bundlePath)) {
    throw new Error("Missing semantic bridge bundle. Run npm run build:semantic-bridge first.");
  }

  if (existsSync(archivePath)) rmSync(archivePath);

  const result = spawnSync("zip", buildZipArguments(archivePath), {
    cwd: bundleDirectory,
    stdio: "inherit",
  });

  if (result.error && process.platform === "win32") {
    const fallback = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Compress-Archive -LiteralPath 'index.js' -DestinationPath '${archivePath}' -Force`,
      ],
      { cwd: bundleDirectory, stdio: "inherit" },
    );
    if (fallback.error || fallback.status !== 0) {
      throw new Error("Unable to create Lambda package with zip or Compress-Archive");
    }
  } else if (result.error) {
    throw new Error(`Unable to create Lambda package with zip: ${result.error.message}`);
  }
  if (!result.error && result.status !== 0) {
    throw new Error(`zip exited with status ${result.status}`);
  }

  console.log(`Created ${archivePath}`);
}
