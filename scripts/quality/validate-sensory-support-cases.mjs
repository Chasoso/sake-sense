import Ajv from "ajv";
import { readJson } from "./read-json.mjs";

const schema = readJson("schemas/sensory-support-cases.schema.json");
const dataset = readJson("src/domain/data/sensory-support-cases.v0.1.json");
const expressions = readJson("src/domain/data/sensory-expressions.v0.1.json");
const states = readJson("src/domain/data/sensory-interpretation-states.v0.1.json");
const validate = new Ajv({ allErrors: true }).compile(schema);

if (!validate(dataset)) {
  console.error(validate.errors);
  process.exit(1);
}

const caseIds = new Set();
const patternKeys = new Set();
const expressionIds = new Set(expressions.expressions.map((expression) => expression.id));
const stateIds = new Set(states.states.map((state) => state.id));
const bodyFeatureValues = {
  duration: new Set(["short", "lingering", "unknown"]),
  ending: new Set(["abrupt", "gradual", "continued", "unknown"]),
  expansion: new Set(["expanding", "contracting", "unknown"]),
  direction: new Set(["upward", "downward", "lateral", "unknown"]),
  repetition: new Set(["single", "repeated", "unknown"]),
  participation: new Set(["localized", "broad", "unknown"]),
  spread: new Set(["compact", "broad", "unknown"]),
  speed: new Set(["sustained-fast", "unknown"]),
};
const voiceFeatureValues = {
  endingBehavior: new Set(["maintained", "fading", "unknown"]),
};
const isRange = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length || keys.some((key) => key !== "minimum" && key !== "maximum")) return false;
  const { minimum, maximum } = value;
  return (
    (minimum === undefined || (typeof minimum === "number" && minimum >= 0)) &&
    (maximum === undefined || (typeof maximum === "number" && maximum >= 0)) &&
    !(typeof minimum === "number" && typeof maximum === "number" && minimum > maximum)
  );
};
for (const supportCase of dataset.cases) {
  if (caseIds.has(supportCase.id))
    throw new Error(`Duplicate sensory support case ID: ${supportCase.id}`);
  caseIds.add(supportCase.id);
  const patternKey = `${supportCase.modality}:${JSON.stringify(supportCase.featurePattern)}`;
  if (patternKeys.has(patternKey)) throw new Error(`Duplicate support pattern: ${supportCase.id}`);
  patternKeys.add(patternKey);
  if (supportCase.expressionIds.some((id) => !expressionIds.has(id) || stateIds.has(id))) {
    throw new Error(`Unknown support expression in ${supportCase.id}`);
  }
  if (supportCase.resultKind === "expression" && !supportCase.expressionIds.length) {
    throw new Error(`Expression result requires an expression ID: ${supportCase.id}`);
  }
  if (supportCase.resultKind !== "expression" && supportCase.expressionIds.length) {
    throw new Error(`Non-expression result cannot have expression IDs: ${supportCase.id}`);
  }
  if (
    supportCase.resultKind === "interpretation-state" &&
    !stateIds.has(supportCase.interpretationStateId)
  ) {
    throw new Error(`Unknown interpretation state in ${supportCase.id}`);
  }
  for (const [key, value] of Object.entries(supportCase.featurePattern)) {
    if (supportCase.modality === "body") {
      if (!bodyFeatureValues[key]?.has(value)) {
        throw new Error(`Invalid body feature pattern ${key} in ${supportCase.id}`);
      }
    } else if (key === "durationMs") {
      if (!isRange(value)) throw new Error(`Invalid voice duration pattern in ${supportCase.id}`);
    } else if (
      !(
        (key === "averageIntensity" && typeof value === "number" && value >= 0 && value <= 1) ||
        (key === "pauseCount" &&
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0) ||
        voiceFeatureValues[key]?.has(value)
      )
    ) {
      throw new Error(`Invalid voice feature pattern ${key} in ${supportCase.id}`);
    }
  }
}

console.log(`Sensory support-case validation passed (${dataset.cases.length} cases).`);
