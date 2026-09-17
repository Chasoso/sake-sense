import { readJson } from "./read-json.mjs";

const dictionary = readJson("src/domain/data/sensory-dictionary.v0.1.json");
const expressions = readJson("src/domain/data/sensory-expressions.v0.1.json");
const states = readJson("src/domain/data/sensory-interpretation-states.v0.1.json");
const supportCases = readJson("src/domain/data/sensory-support-cases.v0.1.json");
const breweries = readJson("src/domain/data/ishikawa-breweries.v0.1.json");
const products = readJson("src/domain/data/ishikawa-sake-sample.v0.1.json");

const dictionaryById = new Map(dictionary.entries.map((entry) => [entry.id, entry]));
const expressionIds = new Set(expressions.expressions.map((expression) => expression.id));
const stateIds = new Set(states.states.map((state) => state.id));
const breweryIds = new Set(breweries.memberBreweries.map((brewery) => brewery.id));
const errors = [];

for (const expression of expressions.expressions) {
  for (const termId of expression.candidateTermIds) {
    const term = dictionaryById.get(termId);
    if (!term)
      errors.push(`Unknown candidate term '${termId}' in sensory expression '${expression.id}'`);
    else if (term.vocabularyStatus !== "selectable") {
      errors.push(
        `Non-selectable candidate term '${termId}' in sensory expression '${expression.id}'`,
      );
    }
  }
}

for (const supportCase of supportCases.cases) {
  if ("termId" in supportCase || "candidateTermIds" in supportCase) {
    errors.push(`Direct term shortcut is not allowed in support case '${supportCase.id}'`);
  }
  for (const expressionId of supportCase.expressionIds) {
    if (!expressionIds.has(expressionId)) {
      errors.push(
        `Unknown sensory expression '${expressionId}' in support case '${supportCase.id}'`,
      );
    }
    if (stateIds.has(expressionId)) {
      errors.push(
        `Interpretation state '${expressionId}' used as expression in support case '${supportCase.id}'`,
      );
    }
  }
  if (
    supportCase.interpretationStateId !== undefined &&
    !stateIds.has(supportCase.interpretationStateId)
  ) {
    errors.push(
      `Unknown interpretation state '${supportCase.interpretationStateId}' in support case '${supportCase.id}'`,
    );
  }
}

for (const product of products.products) {
  if (!breweryIds.has(product.breweryId)) {
    errors.push(`Unknown brewery '${product.breweryId}' in product '${product.id}'`);
  }
  for (const reference of product.termReferences) {
    if (!dictionaryById.has(reference.termId)) {
      errors.push(`Unknown dictionary term '${reference.termId}' in product '${product.id}'`);
    }
  }
}

if (errors.length) throw new Error(errors.join("\n"));
console.log("Domain integrity validation passed (cross-layer references and status boundaries).");
