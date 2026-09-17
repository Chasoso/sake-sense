import Ajv from "ajv";
import { readJson } from "./read-json.mjs";

const schema = readJson("schemas/sensory-expressions.schema.json");
const dataset = readJson("src/domain/data/sensory-expressions.v0.1.json");
const dictionary = readJson("src/domain/data/sensory-dictionary.v0.1.json");
const states = readJson("src/domain/data/sensory-interpretation-states.v0.1.json");
const validate = new Ajv({ allErrors: true }).compile(schema);

if (!validate(dataset)) {
  console.error(validate.errors);
  process.exit(1);
}

const ids = new Set();
const selectableIds = new Set(
  dictionary.entries
    .filter((entry) => entry.vocabularyStatus === "selectable")
    .map((entry) => entry.id),
);
const stateIds = new Set(states.states.map((state) => state.id));
for (const expression of dataset.expressions) {
  if (ids.has(expression.id)) throw new Error(`Duplicate sensory expression ID: ${expression.id}`);
  ids.add(expression.id);
  if (stateIds.has(expression.id)) {
    throw new Error(`Interpretation state cannot be a sensory expression: ${expression.id}`);
  }
  if (new Set(expression.candidateTermIds).size !== expression.candidateTermIds.length) {
    throw new Error(`Duplicate candidate term ID: ${expression.id}`);
  }
  if (expression.candidateTermIds.some((id) => !selectableIds.has(id))) {
    throw new Error(`Non-selectable candidate term in ${expression.id}`);
  }
  if (expression.termLinkStatus === "approved" && !expression.candidateTermIds.length) {
    throw new Error(`Approved link requires a candidate term: ${expression.id}`);
  }
  if (expression.termLinkStatus === "unmapped" && expression.candidateTermIds.length) {
    throw new Error(`Unmapped expression cannot have candidate terms: ${expression.id}`);
  }
}

console.log(`Sensory expression validation passed (${dataset.expressions.length} expressions).`);
