import { readFile } from "node:fs/promises";
import {
  migrateCuratedData,
  validateMigrationResult,
} from "../backend/data-platform/src/migration.mjs";
import { createDynamoRepository } from "../backend/data-platform/src/repository.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const validateOnly = args.has("--validate");

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

const result = migrateCuratedData({
  breweries: await readJson("src/domain/data/ishikawa-breweries.v0.1.json"),
  products: await readJson("src/domain/data/ishikawa-sake-sample.v0.1.json"),
  dictionary: await readJson("src/domain/data/sensory-dictionary.v0.1.json"),
});
const errors = validateMigrationResult(result);
console.log(
  JSON.stringify(
    { mode: apply ? "apply" : validateOnly ? "validate" : "dry-run", ...result.report },
    null,
    2,
  ),
);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
}
if (!apply) process.exit(0);

if (
  !process.env.AWS_REGION ||
  !process.env.BREWERIES_TABLE_NAME ||
  !process.env.PRODUCTS_TABLE_NAME ||
  !process.env.SOURCES_TABLE_NAME ||
  !process.env.PRODUCT_EVIDENCE_TABLE_NAME
) {
  throw new Error("--apply requires AWS_REGION and all four *_TABLE_NAME environment variables");
}
const repository = createDynamoRepository();
for (const [name, items] of Object.entries({
  breweries: result.breweries,
  products: result.products,
  sources: result.sources,
  evidence: result.evidence,
})) {
  for (const item of items) await repository.put(name, item);
  console.log(`wrote ${items.length} ${name}`);
}
