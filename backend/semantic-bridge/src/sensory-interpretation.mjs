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

function isNonEmptyJapaneseText(value) {
  return typeof value === "string" && value.trim().length > 0 && /[ぁ-んァ-ヶ一-龯]/u.test(value);
}

function invalid(code, path, error) {
  return { ok: false, code, path, error };
}

export function validateSensoryInterpretation(value) {
  if (!isRecord(value) || typeof value.outcome !== "string") {
    return invalid("invalid_type", "outcome", "invalid sensory interpretation shape");
  }
  if (!semanticOutcomes.includes(value.outcome)) {
    return invalid("invalid_enum", "outcome", "invalid semantic outcome");
  }

  if (value.outcome === "interpreted") {
    const keys = ["outcome", "sensoryExpression", "semanticProfile", "experimentalProfile"];
    const unexpectedKey = Object.keys(value).find((key) => !keys.includes(key));
    if (unexpectedKey)
      return invalid("unexpected_key", unexpectedKey, "invalid interpreted sensory profile");
    if (!Object.prototype.hasOwnProperty.call(value, "sensoryExpression")) {
      return invalid(
        "missing_required_field",
        "sensoryExpression",
        "invalid interpreted sensory profile",
      );
    }
    if (!isNonEmptyJapaneseText(value.sensoryExpression)) {
      return invalid("invalid_type", "sensoryExpression", "invalid interpreted sensory profile");
    }
    if (!Object.prototype.hasOwnProperty.call(value, "semanticProfile")) {
      return invalid(
        "missing_required_field",
        "semanticProfile",
        "invalid interpreted sensory profile",
      );
    }
    if (!isRecord(value.semanticProfile)) {
      return invalid("invalid_type", "semanticProfile", "invalid interpreted sensory profile");
    }
    const unexpectedPrimaryKey = Object.keys(value.semanticProfile).find(
      (key) => !Object.prototype.hasOwnProperty.call(primarySemanticProfileValues, key),
    );
    if (unexpectedPrimaryKey) {
      return invalid(
        "unexpected_key",
        `semanticProfile.${unexpectedPrimaryKey}`,
        "invalid interpreted sensory profile",
      );
    }
    const missingPrimaryKey = Object.keys(primarySemanticProfileValues).find(
      (key) => !Object.prototype.hasOwnProperty.call(value.semanticProfile, key),
    );
    if (missingPrimaryKey) {
      return invalid(
        "missing_required_field",
        `semanticProfile.${missingPrimaryKey}`,
        "invalid interpreted sensory profile",
      );
    }
    const invalidPrimaryKey = Object.keys(primarySemanticProfileValues).find(
      (key) => !primarySemanticProfileValues[key].includes(value.semanticProfile[key]),
    );
    if (invalidPrimaryKey) {
      return invalid(
        "invalid_enum",
        `semanticProfile.${invalidPrimaryKey}`,
        "invalid interpreted sensory profile",
      );
    }
    if (value.experimentalProfile !== undefined) {
      if (!isRecord(value.experimentalProfile)) {
        return invalid(
          "invalid_type",
          "experimentalProfile",
          "invalid interpreted sensory profile",
        );
      }
      const unexpectedExperimentalKey = Object.keys(value.experimentalProfile).find(
        (key) => !Object.prototype.hasOwnProperty.call(experimentalSemanticProfileValues, key),
      );
      if (unexpectedExperimentalKey) {
        return invalid(
          "unexpected_key",
          `experimentalProfile.${unexpectedExperimentalKey}`,
          "invalid interpreted sensory profile",
        );
      }
      const invalidExperimentalKey = Object.keys(value.experimentalProfile).find(
        (key) => !experimentalSemanticProfileValues[key].includes(value.experimentalProfile[key]),
      );
      if (invalidExperimentalKey) {
        return invalid(
          "invalid_enum",
          `experimentalProfile.${invalidExperimentalKey}`,
          "invalid interpreted sensory profile",
        );
      }
    }
    return { ok: true, value };
  }

  const unexpectedKey = Object.keys(value).find(
    (key) => !["outcome", "sensoryExpression"].includes(key),
  );
  if (unexpectedKey)
    return invalid(
      "unexpected_key",
      unexpectedKey,
      `invalid ${value.outcome} sensory interpretation`,
    );
  if (
    value.outcome === "ambiguous" &&
    !Object.prototype.hasOwnProperty.call(value, "sensoryExpression")
  ) {
    return invalid(
      "missing_required_field",
      "sensoryExpression",
      `invalid ${value.outcome} sensory interpretation`,
    );
  }
  if (value.sensoryExpression !== undefined && !isNonEmptyJapaneseText(value.sensoryExpression)) {
    return invalid(
      "invalid_type",
      "sensoryExpression",
      `invalid ${value.outcome} sensory interpretation`,
    );
  }
  return { ok: true, value };
}
