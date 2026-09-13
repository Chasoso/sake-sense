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
  "sensoryExpressions",
  "candidateTermIds",
  "unmappedFeatures",
  "reason",
];

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
  "The input is not a taste measurement. Do not infer emotion, personality, preference, demographics, intoxication, health, or objective quality.",
  "Do not recommend, rank, or claim scientific certainty. Use only supplied dictionary candidate IDs; zero candidates is valid.",
  "Keep ambiguity in unmappedFeatures and output only the required JSON schema.",
].join(" ");
