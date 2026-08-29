import { execFileSync } from "node:child_process";

try {
  execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
    stdio: "ignore",
  });
} catch {
  // Installing dependencies outside a Git checkout should remain possible.
}
