export const semanticOutcomes = ["interpreted", "ambiguous", "insufficient"] as const;
export type SemanticOutcome = (typeof semanticOutcomes)[number];

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
} as const;

export const experimentalSemanticProfileValues = {
  softness: ["soft", "firm", "unknown"],
  symmetry: ["balanced", "asymmetric", "unknown"],
  verticality: ["rising", "sinking", "neutral", "unknown"],
  approach: ["advancing", "retreating", "neutral", "unknown"],
} as const;

export type PrimarySemanticProfile = {
  [Key in keyof typeof primarySemanticProfileValues]: (typeof primarySemanticProfileValues)[Key][number];
};

export type ExperimentalSemanticProfile = Partial<{
  [Key in keyof typeof experimentalSemanticProfileValues]: (typeof experimentalSemanticProfileValues)[Key][number];
}>;

export type AiSensoryInterpretation =
  | {
      outcome: "interpreted";
      sensoryExpression: string;
      semanticProfile: PrimarySemanticProfile;
      experimentalProfile?: ExperimentalSemanticProfile;
    }
  | {
      outcome: "ambiguous";
      sensoryExpression: string;
    }
  | {
      outcome: "insufficient";
      sensoryExpression?: string;
    };

export type SensoryInterpretationValidation =
  | { ok: true; value: AiSensoryInterpretation }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isNonEmptyJapaneseText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && /[ぁ-んァ-ヶ一-龯]/u.test(value);
}

function validateProfile(
  value: unknown,
  values: Record<string, readonly string[]>,
  required: boolean,
): boolean {
  if (!isRecord(value)) return !required && value === undefined;
  if (!hasOnlyKeys(value, Object.keys(values))) return false;
  if (required && Object.keys(value).length !== Object.keys(values).length) return false;
  return Object.entries(value).every(
    ([key, entry]) => typeof entry === "string" && values[key]?.includes(entry),
  );
}

export function validateSensoryInterpretation(raw: unknown): SensoryInterpretationValidation {
  if (!isRecord(raw) || typeof raw.outcome !== "string") {
    return { ok: false, error: "invalid sensory interpretation shape" };
  }

  if (!semanticOutcomes.includes(raw.outcome as SemanticOutcome)) {
    return { ok: false, error: "invalid semantic outcome" };
  }

  if (raw.outcome === "interpreted") {
    if (
      !hasOnlyKeys(raw, [
        "outcome",
        "sensoryExpression",
        "semanticProfile",
        "experimentalProfile",
      ]) ||
      !isNonEmptyJapaneseText(raw.sensoryExpression) ||
      !validateProfile(raw.semanticProfile, primarySemanticProfileValues, true) ||
      !validateProfile(raw.experimentalProfile, experimentalSemanticProfileValues, false)
    ) {
      return { ok: false, error: "invalid interpreted sensory profile" };
    }
    return { ok: true, value: raw as AiSensoryInterpretation };
  }

  const allowedKeys =
    raw.outcome === "ambiguous"
      ? ["outcome", "sensoryExpression"]
      : ["outcome", "sensoryExpression"];
  if (
    !hasOnlyKeys(raw, allowedKeys) ||
    (raw.outcome === "ambiguous" && !isNonEmptyJapaneseText(raw.sensoryExpression)) ||
    (raw.sensoryExpression !== undefined && !isNonEmptyJapaneseText(raw.sensoryExpression))
  ) {
    return { ok: false, error: `invalid ${raw.outcome} sensory interpretation` };
  }

  return { ok: true, value: raw as AiSensoryInterpretation };
}
