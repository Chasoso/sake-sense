import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import expressionData from "./data/sensory-expressions.v0.1.json";
import interpretationStateData from "./data/sensory-interpretation-states.v0.1.json";

export type ExpressionStatus = "active" | "experimental" | "reference-only" | "deprecated";
export type TermLinkStatus = "approved" | "candidate" | "unmapped";

export type SensoryExpression = {
  id: string;
  displayText: string;
  interpretationNote: string;
  expressionStatus: ExpressionStatus;
  termLinkStatus: TermLinkStatus;
  candidateTermIds: string[];
  represents: string[];
  doesNotRepresent: string[];
  provenanceType: string;
  notes: string;
};

export type SensoryInterpretationState = {
  id: "ambiguous-mixed" | "insufficient-expression";
  displayText: string;
};

type SensoryExpressionDataset = {
  version: string;
  status: string;
  expressions: SensoryExpression[];
};

type SensoryInterpretationStateDataset = {
  version: string;
  states: SensoryInterpretationState[];
};

type SensoryExpressionValidationDataset = {
  expressions: Array<
    Omit<SensoryExpression, "expressionStatus" | "termLinkStatus"> & {
      expressionStatus: string;
      termLinkStatus: string;
    }
  >;
};

export const sensoryExpressionDataset = expressionData as SensoryExpressionDataset;
export const sensoryExpressions = sensoryExpressionDataset.expressions;
export const sensoryInterpretationStateDataset =
  interpretationStateData as SensoryInterpretationStateDataset;
export const sensoryInterpretationStates = sensoryInterpretationStateDataset.states;

const expressionStatusValues = new Set<string>([
  "active",
  "experimental",
  "reference-only",
  "deprecated",
]);
const termLinkStatusValues = new Set<string>(["approved", "candidate", "unmapped"]);

export function getSensoryExpression(id: string): SensoryExpression | undefined {
  return sensoryExpressions.find((expression) => expression.id === id);
}

export function getSensoryExpressionDisplayText(id: string): string | undefined {
  return getSensoryExpression(id)?.displayText;
}

export function getApprovedCandidateTermIds(expressionId: string): string[] {
  const expression = getSensoryExpression(expressionId);
  return expression?.termLinkStatus === "approved" ? expression.candidateTermIds : [];
}

export function getSensoryInterpretationState(id: string): SensoryInterpretationState | undefined {
  return sensoryInterpretationStates.find((state) => state.id === id);
}

export function findSensoryExpressionErrors(
  dataset: SensoryExpressionValidationDataset,
  dictionary = dictionaryData,
  interpretationStates: readonly { id: string }[] = sensoryInterpretationStates,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const dictionaryById = new Map(dictionary.entries.map((entry) => [entry.id, entry]));
  const stateIds = new Set<string>(interpretationStates.map((state) => state.id));

  for (const expression of dataset.expressions) {
    if (ids.has(expression.id)) errors.push(`Duplicate sensory expression ID: ${expression.id}`);
    ids.add(expression.id);
    if (stateIds.has(expression.id)) {
      errors.push(`Interpretation state cannot be a sensory expression: ${expression.id}`);
    }
    if (!expression.displayText.trim()) errors.push(`Missing display text: ${expression.id}`);
    if (!expression.interpretationNote.trim()) {
      errors.push(`Missing interpretation note: ${expression.id}`);
    }
    if (!expressionStatusValues.has(expression.expressionStatus)) {
      errors.push(`Invalid expression status: ${expression.id}`);
    }
    if (!termLinkStatusValues.has(expression.termLinkStatus)) {
      errors.push(`Invalid term link status: ${expression.id}`);
    }
    if (!expression.represents.length || !expression.doesNotRepresent.length) {
      errors.push(`Missing concept boundary: ${expression.id}`);
    }
    if (new Set(expression.candidateTermIds).size !== expression.candidateTermIds.length) {
      errors.push(`Duplicate candidate term ID: ${expression.id}`);
    }
    for (const termId of expression.candidateTermIds) {
      const term = dictionaryById.get(termId);
      if (!term) errors.push(`Unknown candidate term ${termId} in ${expression.id}`);
      else if (term.vocabularyStatus !== "selectable") {
        errors.push(`Non-selectable candidate term ${termId} in ${expression.id}`);
      }
    }
    if (expression.termLinkStatus === "approved" && !expression.candidateTermIds.length) {
      errors.push(`Approved link requires a candidate term: ${expression.id}`);
    }
    if (expression.termLinkStatus === "unmapped" && expression.candidateTermIds.length) {
      errors.push(`Unmapped expression cannot have candidate terms: ${expression.id}`);
    }
  }
  return errors;
}
