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

export const responseKeys = ["sensoryExpressions", "candidateTermIds", "reason"];

export const requestKeys = ["modality", "input", "allowedTermIds"];

export const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sensoryExpressions: { type: "array", items: { type: "string" } },
    candidateTermIds: { type: "array", items: { type: "string" } },
    unmappedFeatures: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  },
  required: responseKeys,
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
].join(" ");
