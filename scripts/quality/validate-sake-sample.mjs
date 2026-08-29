import Ajv from "ajv";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync("schemas/ishikawa-sake-sample.schema.json", "utf8"));
const sample = JSON.parse(readFileSync("src/domain/data/ishikawa-sake-sample.v0.1.json", "utf8"));
const dictionary = JSON.parse(readFileSync("src/domain/data/sensory-dictionary.v0.1.json", "utf8"));
const ajv = new Ajv({ allErrors: true, formats: { uri: true, date: true } });
const validate = ajv.compile(schema);

if (!validate(sample)) {
  console.error(validate.errors);
  process.exit(1);
}

const termIds = new Set(dictionary.entries.map((entry) => entry.id));
const productIds = new Set();
for (const product of sample.products) {
  if (productIds.has(product.id)) throw new Error(`Duplicate sake product ID: ${product.id}`);
  productIds.add(product.id);
  if (!termIds.size || product.sourceUrl.includes("example.com")) {
    throw new Error(`Invalid product source URL in ${product.id}`);
  }
  if (!product.provenance.length) throw new Error(`Missing provenance in ${product.id}`);
  for (const reference of product.termReferences) {
    if (!termIds.has(reference.termId)) {
      throw new Error(`Unknown dictionary term ${reference.termId} in ${product.id}`);
    }
  }
  for (const source of product.provenance) {
    if (source.url.includes("example.com"))
      throw new Error(`Invalid provenance URL in ${product.id}`);
  }
}

console.log(`Ishikawa sake sample validation passed (${sample.products.length} products).`);
