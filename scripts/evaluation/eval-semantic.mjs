import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outputPath = path.join(
  process.cwd(),
  "node_modules/.cache/sake-sense-semantic-evaluation-runner.mjs",
);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/evaluation/run-semantic-evaluation.mjs")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  outfile: outputPath,
  external: ["@aws-sdk/*"],
});
const runner = await import(`${pathToFileURL(outputPath).href}?run=${Date.now()}`);
await runner.main();
