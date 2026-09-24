import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(import.meta.dirname, "../backend/data-platform/dist");
const require = createRequire(import.meta.url);
for (const name of ["public-handler.js", "admin-handler.js"]) {
  const path = resolve(directory, name);
  if (!existsSync(path)) throw new Error(`Missing packaged handler: ${name}`);
  const module = require(path);
  if (typeof module.handler !== "function") throw new Error(`${name} does not export handler()`);
}
console.log("Data-platform CommonJS handler smoke test passed.");
