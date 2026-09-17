import Ajv from "ajv";
import { readJson } from "./read-json.mjs";

const schema = readJson("schemas/sensory-dictionary.schema.json");
const dictionary = readJson("src/domain/data/sensory-dictionary.v0.1.json");
const ajv = new Ajv({ allErrors: true, formats: { uri: true, date: true } });
const validate = ajv.compile(schema);

if (!validate(dictionary)) {
  console.error(validate.errors);
  process.exit(1);
}

const entryIds = new Set();
for (const entry of dictionary.entries) {
  if (entryIds.has(entry.id)) {
    console.error(`Duplicate dictionary entry ID: ${entry.id}`);
    process.exit(1);
  }
  entryIds.add(entry.id);
}

for (const entry of dictionary.entries) {
  if (entry.parentTermId === entry.id) {
    console.error(`Entry cannot parent itself: ${entry.id}`);
    process.exit(1);
  }
  if (entry.parentTermId && !entryIds.has(entry.parentTermId)) {
    console.error(`Unknown parent term ${entry.parentTermId} in ${entry.id}`);
    process.exit(1);
  }
}

console.log(`Dictionary validation passed (${dictionary.entries.length} entries).`);
