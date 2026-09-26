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
export const gestureInputKeys = [
  "durationMs",
  "pointCount",
  "pathLength",
  "averageSpeed",
  "spread",
  "horizontalDirectionChanges",
  "endingSpeedRatio",
  "abruptEnding",
];

export const responseKeys = [
  "sensoryInterpretation",
  "sensoryClassProposals",
  "sensoryExpressions",
  "candidateTermIds",
  "unmappedFeatures",
  "reason",
];
export const requiredResponseKeys = ["sensoryExpressions", "candidateTermIds", "reason"];
export const providerRequiredResponseKeys = [
  "sensoryInterpretation",
  "sensoryExpressions",
  "candidateTermIds",
  "reason",
];

export const requestKeys = ["modality", "input", "allowedTermIds"];

const primarySemanticProfileSchema = {
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
  required: [
    "timeQuality",
    "weightQuality",
    "flowQuality",
    "directness",
    "persistence",
    "resolution",
    "continuity",
    "rhythmicity",
    "expansion",
    "spread",
    "smoothness",
    "roundness",
  ],
};

const experimentalSemanticProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    softness: { type: "string", enum: ["soft", "firm", "unknown"] },
    symmetry: { type: "string", enum: ["balanced", "asymmetric", "unknown"] },
    verticality: { type: "string", enum: ["rising", "sinking", "neutral", "unknown"] },
    approach: { type: "string", enum: ["advancing", "retreating", "neutral", "unknown"] },
  },
};

const sensoryInterpretationSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: {
        outcome: { type: "string", enum: ["interpreted"] },
        sensoryExpression: { type: "string" },
        semanticProfile: primarySemanticProfileSchema,
        experimentalProfile: experimentalSemanticProfileSchema,
      },
      required: ["outcome", "sensoryExpression", "semanticProfile"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        outcome: { type: "string", enum: ["ambiguous"] },
        sensoryExpression: { type: "string" },
      },
      required: ["outcome", "sensoryExpression"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        outcome: { type: "string", enum: ["insufficient"] },
        sensoryExpression: { type: "string" },
      },
      required: ["outcome"],
    },
  ],
};

export const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sensoryInterpretation: {
      ...sensoryInterpretationSchema,
    },
    sensoryClassProposals: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "lingering-after-feel",
          "clean-fade",
          "smooth-flow",
          "rounded-enveloping",
          "light-delicate",
          "rich-full",
          "unmapped",
        ],
      },
    },
    sensoryExpressions: { type: "array", items: { type: "string" } },
    candidateTermIds: { type: "array", items: { type: "string" } },
    unmappedFeatures: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  },
  required: providerRequiredResponseKeys,
};

export const systemInstruction = [
  "Interpret only the supplied compact observable body, voice, or gesture features as a cautious, metaphorical sensory impression.",
  "Use the complete feature combination holistically; do not apply one-to-one feature-to-value rules or reconstruct the reviewed support-case table.",
  "The input is not a taste measurement. Do not claim to detect actual sake taste, emotion, personality, preference, demographics, intoxication, health, or objective quality.",
  "Return semantic outcome interpreted, ambiguous, or insufficient. These are semantic states, not provider or transport failures.",
  "For interpreted, return every Primary semanticProfile axis using only its schema enum. Use unknown when an axis cannot be judged safely; use neutral only where the schema permits it.",
  "For ambiguous or insufficient, return no semanticProfile or experimentalProfile; ambiguous still requires sensoryExpression, while insufficient may omit it according to the schema.",
  "Primary axis meanings: timeQuality is sudden versus sustained timing; weightQuality is light versus strong felt force; flowQuality is bound versus free movement; directness is focused/direct versus indirect/drifting; persistence is brief, moderate, or lingering impression; resolution is abrupt, gradual, or unresolved ending; continuity is continuous versus interrupted; rhythmicity is singular, regular, or wavering; expansion is expansive, condensing, or neutral; spread is spreading, enclosing, or neutral; smoothness is smooth versus rough; roundness is rounded versus angular.",
  "Experimental profile axes are optional and evaluation-only: softness soft/firm, symmetry balanced/asymmetric, verticality rising/sinking/neutral, and approach advancing/retreating/neutral. Do not add axes or arbitrary keys.",
  "For an interpreted outcome, propose zero, one, or two sensory classes from the finite sensoryClassProposals enum only. Use unmapped alone when no reviewed class fits; never mix unmapped with normal classes. Do not propose normal classes for ambiguous or insufficient outcomes.",
  "Write sensoryExpression and reason as concise, cautious Japanese user-facing text. sensoryExpression is presentation-only and must not authorize a sake term.",
  "Do not return authoritative sake term IDs, product IDs, recommendations, provenance judgments, or availability judgments. Return an empty candidateTermIds array.",
  "The current allowedTermIds field is not semantic evidence and must not be used to reverse-engineer a profile or select a term. Do not output dictionary context or provenance fields.",
].join(" ");
