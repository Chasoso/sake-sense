import { bodyInputKeys, responseKeys, voiceInputKeys } from "./schema.mjs";
import { applyReviewedGrounding } from "./grounding.mjs";
import { validateSensoryInterpretation } from "./sensory-interpretation.mjs";
import dictionaryData from "../../../src/domain/data/sensory-dictionary.v0.1.json" with { type: "json" };

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

export class SemanticBridgeRequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SemanticBridgeRequestValidationError";
    this.statusCode = 400;
  }
}

export class SemanticBridgeProviderValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SemanticBridgeProviderValidationError";
    this.statusCode = 502;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function assert(condition, message, ErrorClass = SemanticBridgeRequestValidationError) {
  if (!condition) throw new ErrorClass(message);
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

function canonicalEntriesById() {
  return new Map(
    dictionaryData.entries
      .filter((entry) => entry.vocabularyStatus === "selectable")
      .map((entry) => [
        entry.id,
        {
          id: entry.id,
          displayTerm: entry.displayTerm,
          definitionSummary: entry.definitionSummary,
          sourceCategory: entry.sourceCategory,
          ...(entry.parentTermId ? { parentTermId: entry.parentTermId } : {}),
        },
      ]),
  );
}

function validateAllowedTermIds(ids) {
  assert(Array.isArray(ids) && ids.length <= 16, "invalid allowed term IDs");
  assert(
    ids.every((id) => typeof id === "string"),
    "invalid allowed term ID",
  );
  assert(new Set(ids).size === ids.length, "duplicate allowed term ID");
  const canonical = canonicalEntriesById();
  assert(
    ids.every((id) => canonical.has(id)),
    "unknown or non-selectable dictionary ID",
  );
  return {
    ids,
    context: ids.map((id) => canonical.get(id)),
  };
}

function hasJapaneseText(value) {
  return /[ぁ-んァ-ン一-龯々〆ヵ]/u.test(value);
}

export function parseAndValidateRequest(raw, { maxBytes = 12_000 } = {}) {
  assert(
    typeof raw === "string" && Buffer.byteLength(raw, "utf8") <= maxBytes,
    "request too large",
  );
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SemanticBridgeRequestValidationError("malformed JSON");
  }
  assert(hasOnlyKeys(value, ["modality", "input", "allowedTermIds"]), "invalid request fields");
  assert(value.modality === "body" || value.modality === "voice", "invalid modality");
  if (value.modality === "body") validateBodyInput(value.input);
  else validateVoiceInput(value.input);
  const { ids, context } = validateAllowedTermIds(value.allowedTermIds);
  return {
    value: {
      modality: value.modality,
      input: value.input,
      allowedTermIds: ids,
      dictionaryContext: context,
    },
    allowedIds: new Set(ids),
  };
}

export function validateModelResponse(value, allowedIds, request) {
  assert(
    isRecord(value) && Object.keys(value).every((key) => responseKeys.includes(key)),
    "invalid model response fields",
    SemanticBridgeProviderValidationError,
  );
  for (const key of ["sensoryExpressions", "candidateTermIds"]) {
    assert(
      Array.isArray(value[key]) && value[key].every((item) => typeof item === "string"),
      "invalid model response array",
      SemanticBridgeProviderValidationError,
    );
  }
  assert(
    typeof value.reason === "string" && value.reason.trim().length > 0,
    "invalid model response reason",
    SemanticBridgeProviderValidationError,
  );
  if (value.sensoryInterpretation !== undefined) {
    const interpretation = validateSensoryInterpretation(value.sensoryInterpretation);
    assert(
      interpretation.ok,
      interpretation.ok ? "" : interpretation.error,
      SemanticBridgeProviderValidationError,
    );
  }
  assert(
    value.sensoryExpressions.every((expression) => hasJapaneseText(expression)) &&
      hasJapaneseText(value.reason),
    "model response must use Japanese user-facing text",
    SemanticBridgeProviderValidationError,
  );
  assert(
    new Set(value.candidateTermIds).size === value.candidateTermIds.length,
    "duplicate candidate ID",
    SemanticBridgeProviderValidationError,
  );
  assert(
    value.candidateTermIds.every((id) => allowedIds.has(id)),
    "unknown candidate ID",
    SemanticBridgeProviderValidationError,
  );
  return applyReviewedGrounding(value, request, allowedIds);
}
