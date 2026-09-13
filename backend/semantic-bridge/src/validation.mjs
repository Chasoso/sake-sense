import { bodyInputKeys, responseKeys, voiceInputKeys } from "./schema.mjs";

const bodyValues = {
  duration: ["short", "lingering", "unknown"],
  ending: ["abrupt", "gradual", "continued", "unknown"],
  expansion: ["expanding", "contracting", "unknown"],
  direction: ["upward", "downward", "lateral", "unknown"],
  repetition: ["single", "repeated", "unknown"],
  participation: ["localized", "broad", "unknown"],
  spread: ["compact", "broad", "unknown"],
  speed: ["sustained-fast", "unknown"],
};

const voiceValues = {
  endingBehavior: ["maintained", "fading", "unknown"],
};

export class SemanticBridgeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SemanticBridgeValidationError";
    this.statusCode = 400;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function assert(condition, message) {
  if (!condition) throw new SemanticBridgeValidationError(message);
}

function validateBodyInput(input) {
  assert(hasOnlyKeys(input, bodyInputKeys), "invalid body input fields");
  for (const key of bodyInputKeys) {
    assert(
      typeof input[key] === "string" && bodyValues[key].includes(input[key]),
      "invalid body input value",
    );
  }
}

function validateVoiceInput(input) {
  assert(hasOnlyKeys(input, voiceInputKeys), "invalid voice input fields");
  assert(
    Number.isFinite(input.durationMs) && input.durationMs >= 0 && input.durationMs <= 60_000,
    "invalid voice duration",
  );
  assert(
    Number.isFinite(input.averageIntensity) &&
      input.averageIntensity >= 0 &&
      input.averageIntensity <= 1,
    "invalid voice intensity",
  );
  assert(
    Number.isInteger(input.pauseCount) && input.pauseCount >= 0 && input.pauseCount <= 100,
    "invalid voice pause count",
  );
  assert(voiceValues.endingBehavior.includes(input.endingBehavior), "invalid voice ending");
}

function validateDictionaryContext(context, allowedTermIds) {
  assert(Array.isArray(context) && context.length <= 16, "invalid dictionary context");
  const ids = new Set();
  for (const entry of context) {
    assert(
      hasOnlyKeys(entry, ["id", "displayTerm", "definitionSummary", "dimensions"]),
      "invalid dictionary context fields",
    );
    assert(
      typeof entry.id === "string" && allowedTermIds.has(entry.id) && !ids.has(entry.id),
      "invalid dictionary ID",
    );
    assert(
      typeof entry.displayTerm === "string" && typeof entry.definitionSummary === "string",
      "invalid dictionary context text",
    );
    assert(Array.isArray(entry.dimensions), "invalid dictionary dimensions");
    ids.add(entry.id);
  }
  return ids;
}

export function parseAndValidateRequest(raw, { maxBytes = 12_000, allowedTermIds }) {
  assert(
    typeof raw === "string" && Buffer.byteLength(raw, "utf8") <= maxBytes,
    "request too large",
  );
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SemanticBridgeValidationError("malformed JSON");
  }
  assert(hasOnlyKeys(value, ["modality", "input", "dictionaryContext"]), "invalid request fields");
  assert(value.modality === "body" || value.modality === "voice", "invalid modality");
  if (value.modality === "body") validateBodyInput(value.input);
  else validateVoiceInput(value.input);
  const allowedIds = validateDictionaryContext(value.dictionaryContext, allowedTermIds);
  return { value, allowedIds };
}

export function validateModelResponse(value, allowedIds) {
  assert(
    isRecord(value) && Object.keys(value).every((key) => responseKeys.includes(key)),
    "invalid model response fields",
  );
  for (const key of ["sensoryExpressions", "candidateTermIds", "unmappedFeatures"]) {
    assert(
      Array.isArray(value[key]) && value[key].every((item) => typeof item === "string"),
      "invalid model response array",
    );
  }
  assert(
    typeof value.reason === "string" && value.reason.trim().length > 0,
    "invalid model response reason",
  );
  assert(
    new Set(value.candidateTermIds).size === value.candidateTermIds.length,
    "duplicate candidate ID",
  );
  assert(
    value.candidateTermIds.every((id) => allowedIds.has(id)),
    "unknown candidate ID",
  );
  return value;
}
