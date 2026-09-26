import supportCaseData from "../../../src/domain/data/sensory-support-cases.v0.1.json" with { type: "json" };
import expressionData from "../../../src/domain/data/sensory-expressions.v0.1.json" with { type: "json" };
import { authorizeSensoryTerms } from "./semantic-authorization.mjs";

const expressionById = new Map(
  expressionData.expressions.map((expression) => [expression.id, expression]),
);

function featureList(input) {
  return Object.entries(input).map(([key, value]) => `${key}:${value}`);
}

function patternFeatureList(pattern) {
  return Object.entries(pattern).map(([key, value]) =>
    typeof value === "object" && value !== null
      ? `${key}:${JSON.stringify(value)}`
      : `${key}:${value}`,
  );
}

function matchesPattern(input, pattern) {
  return Object.entries(pattern).every(([key, value]) => {
    if (key === "durationMs" && value && typeof value === "object") {
      return (
        (value.minimum === undefined || input.durationMs >= value.minimum) &&
        (value.maximum === undefined || input.durationMs <= value.maximum)
      );
    }
    return input[key] === value;
  });
}

function specificity(case_) {
  return Object.keys(case_.featurePattern).length;
}

function evaluateMatchedCases(matches) {
  if (!matches.length) return { matchedCaseIds: [], resultKind: "unmapped", expressionIds: [] };

  const stateSpecificity = Math.max(
    -1,
    ...matches.filter((case_) => case_.resultKind === "interpretation-state").map(specificity),
  );
  if (stateSpecificity >= 0) {
    const states = matches.filter(
      (case_) =>
        case_.resultKind === "interpretation-state" && specificity(case_) === stateSpecificity,
    );
    const stateIds = [
      ...new Set(states.map((case_) => case_.interpretationStateId).filter(Boolean)),
    ];
    if (stateIds.length === 1) {
      return {
        matchedCaseIds: states.map((case_) => case_.id),
        resultKind: "interpretation-state",
        expressionIds: [],
        interpretationStateId: stateIds[0],
      };
    }
  }

  const expressionIds = [...new Set(matches.flatMap((case_) => case_.expressionIds))];
  if (expressionIds.length === 1) {
    return {
      matchedCaseIds: matches.map((case_) => case_.id),
      resultKind: "expression",
      expressionIds,
    };
  }
  if (!expressionIds.length) {
    return {
      matchedCaseIds: matches.map((case_) => case_.id),
      resultKind: "unmapped",
      expressionIds: [],
    };
  }
  return {
    matchedCaseIds: matches.map((case_) => case_.id),
    resultKind: "interpretation-state",
    expressionIds: [],
    interpretationStateId: "ambiguous-mixed",
  };
}

function evaluateSupport(request) {
  const matches = supportCaseData.cases.filter(
    (case_) =>
      (case_.status === "active" || case_.status === "experimental") &&
      case_.modality === request.modality &&
      matchesPattern(request.input, case_.featurePattern),
  );
  return { evaluation: evaluateMatchedCases(matches), matches };
}

export function getLegacyGroundingObservation(request) {
  const { evaluation } = evaluateSupport(request);
  return {
    interpretationStateId: evaluation.interpretationStateId ?? null,
    groundingOutcome:
      evaluation.interpretationStateId === "ambiguous-mixed"
        ? "ambiguous"
        : evaluation.interpretationStateId
          ? "insufficient"
          : evaluation.expressionIds.length
            ? "interpreted"
            : "insufficient",
    groundingCaseIds: evaluation.matchedCaseIds,
    groundingExpressionIds: evaluation.expressionIds,
  };
}

function legacyPresentation(evaluation) {
  if (evaluation.resultKind === "expression") {
    return {
      sensoryExpressions: evaluation.expressionIds.flatMap((id) => {
        const expression = expressionById.get(id);
        return expression?.displayText ? [expression.displayText] : [];
      }),
      reason: "既存のレビュー済みルールに基づく既定の感覚表現です。",
    };
  }
  if (evaluation.resultKind === "interpretation-state") {
    return {
      sensoryExpressions: [],
      reason: "既存のレビュー済みルールでは候補を一つに確定しません。",
    };
  }
  return {
    sensoryExpressions: [],
    reason: "既存のレビュー済みルールでは安全な感覚表現を確定しません。",
  };
}

/**
 * The model may translate wording, but reviewed support cases and approved
 * expression links remain diagnostic/fixture data for Body and Voice. Gesture
 * keeps its pre-cutover compatibility path.
 */
export function applyReviewedGrounding(modelResponse, request, allowedIds) {
  const { evaluation, matches } = evaluateSupport(request);
  const presentation = legacyPresentation(evaluation);
  const matchedCases = matches.filter((case_) => evaluation.matchedCaseIds.includes(case_.id));
  const selectedCases =
    evaluation.resultKind === "expression"
      ? matchedCases.filter((case_) =>
          case_.expressionIds.some((id) => evaluation.expressionIds.includes(id)),
        )
      : evaluation.resultKind === "interpretation-state"
        ? matchedCases.filter((case_) => case_.resultKind === "interpretation-state")
        : [];
  const unmappedCases = matchedCases.filter((case_) => case_.resultKind === "unmapped");
  const interpretationEvidence = selectedCases.flatMap((case_) =>
    patternFeatureList(case_.featurePattern),
  );
  const unmappedFeatures = unmappedCases.flatMap((case_) =>
    patternFeatureList(case_.featurePattern),
  );
  const observedFeatures = featureList(request.input);
  const accountedFor = new Set([...interpretationEvidence, ...unmappedFeatures]);
  const unusedFeatures = observedFeatures.filter((feature) => !accountedFor.has(feature));
  const semanticAuthorization = modelResponse.sensoryInterpretation
    ? authorizeSensoryTerms(
        modelResponse.sensoryInterpretation,
        modelResponse.sensoryClassProposals ?? [],
        [...allowedIds],
      )
    : null;
  const hasSemanticInterpretation = Boolean(modelResponse.sensoryInterpretation);
  const semanticExpressions =
    typeof modelResponse.sensoryInterpretation?.sensoryExpression === "string"
      ? [modelResponse.sensoryInterpretation.sensoryExpression]
      : [];
  const legacyCandidateTermIds = evaluation.expressionIds
    .flatMap((expressionId) => {
      const expression = expressionById.get(expressionId);
      return expression?.termLinkStatus === "approved" ? expression.candidateTermIds : [];
    })
    .filter((id, index, ids) => allowedIds.has(id) && ids.indexOf(id) === index);
  const useSemanticAuthority = hasSemanticInterpretation && request.modality !== "gesture";
  const candidateTermIds = useSemanticAuthority
    ? (semanticAuthorization?.authorizedTermIds ?? [])
    : request.modality === "gesture"
      ? (semanticAuthorization?.authorizedTermIds ?? legacyCandidateTermIds)
      : [];

  return {
    ...(modelResponse.sensoryInterpretation
      ? { sensoryInterpretation: modelResponse.sensoryInterpretation }
      : {}),
    sensoryClassProposals: modelResponse.sensoryClassProposals ?? [],
    sensoryExpressions: useSemanticAuthority
      ? semanticExpressions
      : presentation.sensoryExpressions,
    candidateTermIds,
    ...(semanticAuthorization
      ? {
          authorization: semanticAuthorization.authorization,
          authorizationConflicts: semanticAuthorization.authorizationConflicts,
        }
      : {}),
    observedFeatures,
    interpretationEvidence,
    unmappedFeatures:
      evaluation.resultKind === "unmapped" && !unmappedFeatures.length
        ? observedFeatures
        : unmappedFeatures,
    unusedFeatures:
      evaluation.resultKind === "unmapped" && !unmappedFeatures.length ? [] : unusedFeatures,
    interpretationStateId:
      request.modality === "gesture" ? (evaluation.interpretationStateId ?? null) : null,
    groundingCaseIds: evaluation.matchedCaseIds,
    groundingExpressionIds: evaluation.expressionIds,
    reason:
      useSemanticAuthority || request.modality !== "gesture"
        ? modelResponse.sensoryInterpretation
          ? modelResponse.reason
          : presentation.reason
        : presentation.reason,
  };
}
