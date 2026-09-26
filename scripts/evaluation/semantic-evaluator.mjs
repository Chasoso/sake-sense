export const evaluatorDimensions = [
  "semanticConsistency",
  "unsupportedInference",
  "ambiguityHandling",
  "profileTextConsistency",
  "wordingQuality",
];

const evaluatorStatuses = ["pass", "review", "fail"];

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function summarizeEvaluatorResponseShape(value) {
  const topLevelKeys = isRecord(value) ? Object.keys(value) : [];
  const dimensions = isRecord(value?.dimensions) ? value.dimensions : null;
  return {
    topLevelType: valueType(value),
    topLevelKeys,
    hasDimensions: Boolean(dimensions),
    dimensionsType: valueType(value?.dimensions),
    dimensionsKeys: dimensions ? Object.keys(dimensions) : [],
  };
}

export function parseEvaluatorResponse(text) {
  if (typeof text !== "string" || text.trim().length === 0) return null;
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateEvaluatorResult(value) {
  if (!isRecord(value) || !isRecord(value.dimensions)) {
    return { ok: false, error: "evaluator result must contain dimensions" };
  }
  const unexpected = Object.keys(value).find((key) => key !== "dimensions");
  if (unexpected) return { ok: false, error: `unexpected evaluator key: ${unexpected}` };
  for (const dimension of evaluatorDimensions) {
    const result = value.dimensions[dimension];
    if (!isRecord(result)) return { ok: false, error: `missing evaluator dimension: ${dimension}` };
    if (!evaluatorStatuses.includes(result.status)) {
      return { ok: false, error: `invalid evaluator status: ${dimension}` };
    }
    if (
      typeof result.rationale !== "string" ||
      result.rationale.trim().length === 0 ||
      result.rationale.length > 280
    ) {
      return { ok: false, error: `invalid evaluator rationale: ${dimension}` };
    }
    const dimensionKeys = Object.keys(result);
    if (dimensionKeys.some((key) => !["status", "rationale"].includes(key))) {
      return { ok: false, error: `unexpected evaluator field: ${dimension}` };
    }
  }
  return { ok: true, value };
}

export function normalizeEvaluatorResult(value) {
  const validation = validateEvaluatorResult(value);
  if (validation.ok) return { status: "completed", dimensions: validation.value.dimensions };
  const dimensions = Object.fromEntries(
    evaluatorDimensions.map((dimension) => [
      dimension,
      {
        status: "fail",
        rationale: "Evaluator response is malformed; human review is required.",
      },
    ]),
  );
  return {
    status: "malformed",
    dimensions,
    error: validation.error,
    responseShape: summarizeEvaluatorResponseShape(value),
  };
}

export function summarizeEvaluatorResults(results) {
  const counts = Object.fromEntries(
    evaluatorDimensions.map((dimension) => [dimension, { pass: 0, review: 0, fail: 0 }]),
  );
  for (const result of results) {
    if (!result?.dimensions) continue;
    for (const dimension of evaluatorDimensions) {
      const status = result.dimensions[dimension]?.status;
      if (evaluatorStatuses.includes(status)) counts[dimension][status] += 1;
    }
  }
  return counts;
}

export function buildEvaluatorPrompt(record) {
  return [
    "Review this sensory interpretation as a cautious assistant, not as a source of semantic truth.",
    "Return one JSON object only. Do not include Markdown code fences or additional keys.",
    'Expected schema: {"dimensions":{"semanticConsistency":{"status":"pass|review|fail","rationale":"short"},"unsupportedInference":{"status":"pass|review|fail","rationale":"short"},"ambiguityHandling":{"status":"pass|review|fail","rationale":"short"},"profileTextConsistency":{"status":"pass|review|fail","rationale":"short"},"wordingQuality":{"status":"pass|review|fail","rationale":"short"}}}',
    "Each dimension is required and must contain only status and rationale.",
    "Do not select sake terms, products, rankings, recommendations, or provenance decisions.",
    "Prefer review when evidence is insufficient rather than rewarding confident guessing.",
    JSON.stringify({
      modality: record.modality,
      observableInput: record.input,
      interpretationOutcome: record.interpretationOutcome,
      wording: record.wording,
      semanticProfile: record.semanticProfile,
    }),
  ].join("\n");
}
