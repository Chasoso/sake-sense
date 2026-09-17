import Ajv from "ajv";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync("schemas/ishikawa-sake-sample.schema.json", "utf8"));
const sample = JSON.parse(readFileSync("src/domain/data/ishikawa-sake-sample.v0.1.json", "utf8"));
const breweries = JSON.parse(readFileSync("src/domain/data/ishikawa-breweries.v0.1.json", "utf8"));
const dictionary = JSON.parse(readFileSync("src/domain/data/sensory-dictionary.v0.1.json", "utf8"));
const ajv = new Ajv({ allErrors: true, formats: { uri: true, date: true } });
const validate = ajv.compile(schema);

if (!validate(sample)) {
  console.error(validate.errors);
  process.exit(1);
}

const termIds = new Set(dictionary.entries.map((entry) => entry.id));
const breweryIds = new Set(breweries.memberBreweries.map((brewery) => brewery.id));
if (breweries.memberBreweries.length !== 32 || breweryIds.size !== 32)
  throw new Error("Ishikawa member brewery baseline must contain exactly 32 unique breweries");
const productIds = new Set();
for (const product of sample.products) {
  if (productIds.has(product.id)) throw new Error(`Duplicate sake product ID: ${product.id}`);
  productIds.add(product.id);
  if (!breweryIds.has(product.breweryId)) throw new Error(`Unknown brewery in ${product.id}`);
  if (!termIds.size || product.sourceUrl.includes("example.com")) {
    throw new Error(`Invalid product source URL in ${product.id}`);
  }
  if (!product.sourceName || !product.sourceReviewedAt || !product.provenanceNotes)
    throw new Error(`Missing provenance in ${product.id}`);
  for (const reference of product.termReferences) {
    if (!termIds.has(reference.termId)) {
      throw new Error(`Unknown dictionary term ${reference.termId} in ${product.id}`);
    }
  }
  if (!product.imageSourcePageUrl || product.imageSourcePageUrl.includes("example.com"))
    throw new Error(`Invalid image source page URL in ${product.id}`);
}

for (const breweryId of breweryIds) {
  if (!sample.products.some((product) => product.breweryId === breweryId))
    throw new Error(`Missing researched product for brewery ${breweryId}`);
}

console.log(
  `Ishikawa sake dataset validation passed (${breweries.memberBreweries.length} breweries, ${sample.products.length} products).`,
);
