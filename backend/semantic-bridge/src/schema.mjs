export const bodyInputKeys = [
  "duration",
  "ending",
  "expansion",
  "direction",
  "repetition",
  "participation",
  "spread",
  "speed",
];

export const voiceInputKeys = ["durationMs", "averageIntensity", "pauseCount", "endingBehavior"];

export const responseKeys = [
  "sensoryInterpretation",
  "sensoryExpressions",
  "candidateTermIds",
  "reason",
];
export const requiredResponseKeys = ["sensoryExpressions", "candidateTermIds", "reason"];

export const requestKeys = ["modality", "input", "allowedTermIds"];

export const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sensoryInterpretation: {
      type: "object",
      additionalProperties: false,
      properties: {
        outcome: { type: "string", enum: ["interpreted", "ambiguous", "insufficient"] },
        sensoryExpression: { type: "string" },
        semanticProfile: {
          type: "object",
          additionalProperties: false,
          properties: {
            timeQuality: { type: "string", enum: ["sudden", "sustained", "unknown"] },
            weightQuality: { type: "string", enum: ["light", "strong", "unknown"] },
            flowQuality: { type: "string", enum: ["bound", "free", "unknown"] },
            directness: { type: "string", enum: ["direct", "indirect", "unknown"] },
            persistence: { type: "string", enum: ["brief", "moderate", "lingering", "unknown"] },
            resolution: { type: "string", enum: ["abrupt", "gradual", "unresolved", "unknown"] },
            continuity: { type: "string", enum: ["continuous", "interrupted", "unknown"] },
            rhythmicity: { type: "string", enum: ["singular", "regular", "wavering", "unknown"] },
            expansion: { type: "string", enum: ["expansive", "condensing", "neutral", "unknown"] },
            spread: { type: "string", enum: ["spreading", "enclosing", "neutral", "unknown"] },
            smoothness: { type: "string", enum: ["smooth", "rough", "unknown"] },
            roundness: { type: "string", enum: ["rounded", "angular", "unknown"] },
          },
        },
        experimentalProfile: {
          type: "object",
          additionalProperties: false,
          properties: {
            softness: { type: "string", enum: ["soft", "firm", "unknown"] },
            symmetry: { type: "string", enum: ["balanced", "asymmetric", "unknown"] },
            verticality: { type: "string", enum: ["rising", "sinking", "neutral", "unknown"] },
            approach: { type: "string", enum: ["advancing", "retreating", "neutral", "unknown"] },
          },
        },
      },
    },
    sensoryExpressions: { type: "array", items: { type: "string" } },
    candidateTermIds: { type: "array", items: { type: "string" } },
    unmappedFeatures: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  },
  required: requiredResponseKeys,
};

export const systemInstruction = [
  "Translate derived observable body or voice features into a cautious beginner-friendly sensory expression.",
  "Write every user-facing sensoryExpressions item and reason in natural Japanese only; never return English feature labels or technical dumps.",
  "Synthesize a small number of concise sensory expressions instead of translating each internal feature literally. Zero expressions is valid when evidence is weak.",
  "The input is not a taste measurement. Do not infer emotion, personality, preference, demographics, intoxication, health, or objective quality.",
  "Keep the reason concise, cautious, and experimental. Do not make authoritative taste claims or recommendation/ranking language.",
  "Use only supplied dictionary candidate IDs; zero candidates is valid.",
  "Do not force a sake term from repeated lateral sway or slow/expanding motion when the dictionary grounding is weak; prefer zero candidates.",
  "The server records observed, used, and unmapped feature provenance deterministically; do not add provenance fields.",
  "If sensoryInterpretation is returned, it is a validated interpretation only: sensoryExpression is presentation-only, semanticProfile is separate, and neither field authorizes sake terms in this phase.",
].join(" ");
