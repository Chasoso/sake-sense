import breweryData from "./data/ishikawa-breweries.v0.1.json";
import sakeSampleData from "./data/ishikawa-sake-sample.v0.1.json";
import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import expressionData from "./data/sensory-expressions.v0.1.json";
import interpretationStateData from "./data/sensory-interpretation-states.v0.1.json";
import supportCaseData from "./data/sensory-support-cases.v0.1.json";
import { findDictionaryErrors } from "./dictionary-validation";
import { findSakeSampleValidationErrors } from "./sake-sample-validation";
import { findSensoryExpressionErrors } from "./sensory-expressions";
import { findSensorySupportCaseErrors } from "./sensory-support-cases";

export type DomainDataIntegrityInput = {
  dictionary: typeof dictionaryData;
  expressions: typeof expressionData;
  interpretationStates: typeof interpretationStateData.states;
  supportCases: typeof supportCaseData;
  breweries: typeof breweryData;
  sakeSample: typeof sakeSampleData;
};

export const mvpDomainData: DomainDataIntegrityInput = {
  dictionary: dictionaryData,
  expressions: expressionData,
  interpretationStates: interpretationStateData.states,
  supportCases: supportCaseData,
  breweries: breweryData,
  sakeSample: sakeSampleData,
};

export function findSensoryInterpretationStateErrors(
  states: readonly { id: string; displayText: string }[],
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const state of states) {
    if (!state.id) {
      errors.push("Missing sensory interpretation state ID");
    } else if (ids.has(state.id)) {
      errors.push(`Duplicate sensory interpretation state ID: ${state.id}`);
    }
    ids.add(state.id);
    if (!state.displayText) {
      errors.push(`Missing display text in sensory interpretation state: ${state.id || "<empty>"}`);
    }
  }
  return errors;
}

/**
 * Validates references across the MVP domain chain. It deliberately permits
 * partial paths: unmapped expressions, candidate links, and terms without a
 * product relation remain valid outcomes.
 */
export function validateDomainDataIntegrity(
  data: DomainDataIntegrityInput = mvpDomainData,
): string[] {
  const errors = [
    ...findDictionaryErrors(data.dictionary),
    ...findSensoryInterpretationStateErrors(data.interpretationStates),
    ...findSensoryExpressionErrors(data.expressions, data.dictionary, data.interpretationStates),
    ...findSensorySupportCaseErrors(
      data.supportCases,
      data.expressions.expressions,
      data.interpretationStates,
    ),
    ...findSakeSampleValidationErrors(data.sakeSample, data.dictionary.entries, data.breweries),
  ];

  for (const supportCase of data.supportCases.cases) {
    if ("termId" in supportCase || "candidateTermIds" in supportCase) {
      errors.push(`Direct term shortcut is not allowed in support case ${supportCase.id}`);
    }
  }
  return errors;
}
