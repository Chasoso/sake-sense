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

export const PROVIDER_ERROR_MESSAGE_MAX_LENGTH = 600;
export const BEDROCK_PROVIDER_TIMEOUT_MS = 25_000;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildLifecycleDiagnostics({
  eventName,
  event,
  startedAt,
  modality,
  model,
  requestSummary,
}) {
  const safeRequestSummary = sanitizeConverseRequestSummary(requestSummary);
  return {
    category: eventName,
    ...(typeof event?.requestContext?.requestId === "string" &&
    event.requestContext.requestId.trim()
      ? { eventRequestId: event.requestContext.requestId }
      : {}),
    ...(typeof modality === "string" ? { modality } : {}),
    ...(typeof model === "string" && model.trim() ? { model } : {}),
    elapsedMs: Math.max(0, Date.now() - startedAt),
    ...(safeRequestSummary ? { requestSummary: safeRequestSummary } : {}),
  };
}

export function emitLifecycleEvent(logger, params) {
  logger.info?.(JSON.stringify(buildLifecycleDiagnostics(params)));
}

export function sanitizeProviderErrorMessage(value) {
  if (typeof value !== "string") return undefined;

  const normalized = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return undefined;

  if (
    /\b(?:authorization|bearer|access[_-]?token|id[_-]?token|session[_-]?token|secret|password|credential)\b/i.test(
      normalized,
    ) ||
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/i.test(normalized)
  ) {
    return undefined;
  }

  return normalized.slice(0, PROVIDER_ERROR_MESSAGE_MAX_LENGTH);
}

function safeStringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").slice(0, 32)
    : undefined;
}

export function sanitizeConverseRequestSummary(value) {
  if (!isRecord(value)) return undefined;
  const summary = {};
  if (typeof value.modelId === "string" && value.modelId.trim()) summary.modelId = value.modelId;
  for (const key of ["hasSystem", "hasInferenceConfig", "hasOutputConfig"]) {
    if (typeof value[key] === "boolean") summary[key] = value[key];
  }
  if (Number.isInteger(value.messageCount) && value.messageCount >= 0) {
    summary.messageCount = value.messageCount;
  }
  for (const key of ["contentBlockTypes", "schemaTopLevelKeys"]) {
    const entries = safeStringArray(value[key]);
    if (entries) summary[key] = entries;
  }
  if (typeof value.textFormatType === "string" && value.textFormatType.trim()) {
    summary.textFormatType = value.textFormatType;
  }
  return summary;
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

export function buildProviderFailureDiagnostics({ error, event, modality, model, elapsedMs }) {
  const sdkMetadata = isRecord(error?.$metadata) ? error.$metadata : null;
  const requestId = sdkMetadata?.requestId;
  const eventRequestId = event?.requestContext?.requestId;
  const diagnostics = {
    category: "provider_failure",
    errorName: typeof error?.name === "string" && error.name.trim() ? error.name : "UnknownError",
    ...(Number.isInteger(sdkMetadata?.httpStatusCode)
      ? { httpStatusCode: sdkMetadata.httpStatusCode }
      : {}),
    ...(typeof requestId === "string" && requestId.trim() ? { requestId } : {}),
    ...(typeof eventRequestId === "string" && eventRequestId.trim() ? { eventRequestId } : {}),
    ...(typeof modality === "string" ? { modality } : {}),
    ...(typeof model === "string" && model.trim() ? { model } : {}),
    ...(typeof elapsedMs === "number" && Number.isFinite(elapsedMs)
      ? { elapsedMs: Math.max(0, Math.round(elapsedMs)) }
      : {}),
    ...(typeof error?.failureKind === "string" ? { failureKind: error.failureKind } : {}),
    ...(typeof error?.providerTimeoutMs === "number" && Number.isFinite(error.providerTimeoutMs)
      ? { providerTimeoutMs: Math.max(0, Math.round(error.providerTimeoutMs)) }
      : {}),
  };

  const errorMessage = sanitizeProviderErrorMessage(error?.message);
  if (errorMessage) diagnostics.errorMessage = errorMessage;
  if (typeof error?.$fault === "string" && error.$fault.trim()) {
    diagnostics.fault = error.$fault;
  }
  if (isRecord(error?.$retryable)) {
    diagnostics.retryable = true;
    if (typeof error.$retryable.throttling === "boolean") {
      diagnostics.throttling = error.$retryable.throttling;
    }
  } else if (typeof sdkMetadata?.retryable === "boolean") {
    diagnostics.retryable = sdkMetadata.retryable;
  }

  const requestSummary = sanitizeConverseRequestSummary(error?.converseRequestSummary);
  if (requestSummary) diagnostics.requestSummary = requestSummary;
  return diagnostics;
}
