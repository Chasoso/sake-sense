const BODY_INPUT_KEYS = [
  "duration",
  "ending",
  "expansion",
  "direction",
  "repetition",
  "participation",
  "spread",
  "speed",
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bucketDuration(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value <= 700) return "short";
  if (value <= 3_000) return "medium";
  return "long";
}

function bucketIntensity(value) {
  if (!Number.isFinite(value)) return "unknown";
  if (value < 0.34) return "low";
  if (value < 0.67) return "medium";
  return "high";
}

export function summarizeSemanticBridgeInput(modality, input) {
  if (!isRecord(input)) return { kind: Array.isArray(input) ? "array" : typeof input };
  if (modality === "body") {
    return Object.fromEntries(BODY_INPUT_KEYS.map((key) => [key, input[key]]));
  }
  if (modality === "voice") {
    return {
      durationMsBucket: bucketDuration(input.durationMs),
      intensityBucket: bucketIntensity(input.averageIntensity),
      pauseCount: Number.isInteger(input.pauseCount) ? input.pauseCount : "unknown",
      endingBehavior: input.endingBehavior,
    };
  }
  return { kind: "unknown_modality" };
}

function arrayCount(value) {
  return Array.isArray(value) ? value.length : undefined;
}

export function summarizeProviderOutput(value) {
  if (!isRecord(value)) {
    return { kind: Array.isArray(value) ? "array" : value === null ? "null" : typeof value };
  }

  const interpretation = isRecord(value.sensoryInterpretation) ? value.sensoryInterpretation : null;
  const semanticProfile =
    interpretation && isRecord(interpretation.semanticProfile)
      ? interpretation.semanticProfile
      : null;
  const experimentalProfile =
    interpretation && isRecord(interpretation.experimentalProfile)
      ? interpretation.experimentalProfile
      : null;

  return {
    kind: "object",
    topLevelKeys: Object.keys(value).sort(),
    sensoryInterpretationPresent: Object.prototype.hasOwnProperty.call(
      value,
      "sensoryInterpretation",
    ),
    ...(interpretation && typeof interpretation.outcome === "string"
      ? { outcome: interpretation.outcome }
      : {}),
    ...(semanticProfile ? { semanticProfileKeys: Object.keys(semanticProfile).sort() } : {}),
    ...(experimentalProfile
      ? { experimentalProfileKeys: Object.keys(experimentalProfile).sort() }
      : {}),
    sensoryExpressionPresent:
      interpretation !== null &&
      Object.prototype.hasOwnProperty.call(interpretation, "sensoryExpression"),
    sensoryExpressionsCount: arrayCount(value.sensoryExpressions),
    candidateTermIdsCount: arrayCount(value.candidateTermIds),
    reasonPresent: Object.prototype.hasOwnProperty.call(value, "reason"),
  };
}

export function buildProviderValidationDiagnostics({
  error,
  event,
  modality,
  input,
  model,
  providerOutput,
  providerOutputKind,
}) {
  const requestId = event?.requestContext?.requestId;
  return {
    category: "provider_validation_failure",
    ...(typeof requestId === "string" && requestId.trim() ? { requestId } : {}),
    ...(typeof modality === "string" ? { modality } : {}),
    ...(typeof model === "string" && model.trim() ? { model } : {}),
    inputSummary: summarizeSemanticBridgeInput(modality, input),
    validation: {
      code: typeof error?.code === "string" ? error.code : "malformed_output",
      path: typeof error?.path === "string" ? error.path : "$",
    },
    providerOutputSummary:
      providerOutput === undefined && providerOutputKind
        ? { kind: providerOutputKind }
        : summarizeProviderOutput(providerOutput),
  };
}
