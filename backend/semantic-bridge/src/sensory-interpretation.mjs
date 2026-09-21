export const semanticOutcomes = ["interpreted", "ambiguous", "insufficient"];

export const primarySemanticProfileValues = {
  timeQuality: ["sudden", "sustained", "unknown"],
  weightQuality: ["light", "strong", "unknown"],
  flowQuality: ["bound", "free", "unknown"],
  directness: ["direct", "indirect", "unknown"],
  persistence: ["brief", "moderate", "lingering", "unknown"],
  resolution: ["abrupt", "gradual", "unresolved", "unknown"],
  continuity: ["continuous", "interrupted", "unknown"],
  rhythmicity: ["singular", "regular", "wavering", "unknown"],
  expansion: ["expansive", "condensing", "neutral", "unknown"],
  spread: ["spreading", "enclosing", "neutral", "unknown"],
  smoothness: ["smooth", "rough", "unknown"],
  roundness: ["rounded", "angular", "unknown"],
};

export const experimentalSemanticProfileValues = {
  softness: ["soft", "firm", "unknown"],
  symmetry: ["balanced", "asymmetric", "unknown"],
  verticality: ["rising", "sinking", "neutral", "unknown"],
  approach: ["advancing", "retreating", "neutral", "unknown"],
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function isNonEmptyJapaneseText(value) {
  return typeof value === "string" && value.trim().length > 0 && /[ぁ-んァ-ヶ一-龯]/u.test(value);
}

function validProfile(value, values, required) {
  if (!isRecord(value)) return !required && value === undefined;
  if (!hasOnlyKeys(value, Object.keys(values))) return false;
  if (required && Object.keys(value).length !== Object.keys(values).length) return false;
  return Object.entries(value).every(
    ([key, entry]) => typeof entry === "string" && values[key]?.includes(entry),
  );
}

export function validateSensoryInterpretation(value) {
  if (!isRecord(value) || typeof value.outcome !== "string") {
    return { ok: false, error: "invalid sensory interpretation shape" };
  }
  if (!semanticOutcomes.includes(value.outcome)) {
    return { ok: false, error: "invalid semantic outcome" };
  }

  if (value.outcome === "interpreted") {
    if (
      !hasOnlyKeys(value, [
        "outcome",
        "sensoryExpression",
        "semanticProfile",
        "experimentalProfile",
      ]) ||
      !isNonEmptyJapaneseText(value.sensoryExpression) ||
      !validProfile(value.semanticProfile, primarySemanticProfileValues, true) ||
      !validProfile(value.experimentalProfile, experimentalSemanticProfileValues, false)
    ) {
      return { ok: false, error: "invalid interpreted sensory profile" };
    }
    return { ok: true, value };
  }

  if (
    !hasOnlyKeys(value, ["outcome", "sensoryExpression"]) ||
    (value.outcome === "ambiguous" && !isNonEmptyJapaneseText(value.sensoryExpression)) ||
    (value.sensoryExpression !== undefined && !isNonEmptyJapaneseText(value.sensoryExpression))
  ) {
    return { ok: false, error: `invalid ${value.outcome} sensory interpretation` };
  }
  return { ok: true, value };
}
