import Ajv from "ajv";
import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync("schemas/sensory-dictionary.schema.json", "utf8"));
const dictionary = JSON.parse(readFileSync("src/domain/data/sensory-dictionary.v0.1.json", "utf8"));
const ajv = new Ajv({ allErrors: true, formats: { uri: true, date: true } });
const validate = ajv.compile(schema);

if (!validate(dictionary)) {
  console.error(validate.errors);
  process.exit(1);
}

const dimensionIds = new Set(dictionary.dimensions.map((dimension) => dimension.id));
const entryIds = new Set();
for (const entry of dictionary.entries) {
  if (entryIds.has(entry.id)) {
    console.error(`Duplicate dictionary entry ID: ${entry.id}`);
    process.exit(1);
  }
  entryIds.add(entry.id);
  for (const dimension of entry.dimensions) {
    if (!dimensionIds.has(dimension.dimensionId)) {
      console.error(`Unknown dimension ${dimension.dimensionId} in ${entry.id}`);
      process.exit(1);
    }
  }
}

console.log(`Dictionary validation passed (${dictionary.entries.length} entries).`);
