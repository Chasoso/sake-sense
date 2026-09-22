import { describe, expect, it } from "vitest";
import { responseSchema } from "./schema.mjs";
import { applyReviewedGrounding } from "./grounding.mjs";
import {
  primarySemanticProfileValues,
  validateSensoryInterpretation,
} from "./sensory-interpretation.mjs";
import { validateModelResponse } from "./validation.mjs";

const primaryProfile = Object.fromEntries(
  Object.entries(primarySemanticProfileValues).map(([key, values]) => [
    key,
    values.includes("unknown") ? "unknown" : values[0],
  ]),
);

const interpreted = {
  outcome: "interpreted",
  sensoryExpression: "ゆっくり広がりながら続く感じ",
  semanticProfile: primaryProfile,
};

const bodyRequest = {
  modality: "body",
  input: {
    duration: "lingering",
    ending: "continued",
    expansion: "unknown",
    direction: "unknown",
    repetition: "single",
    participation: "localized",
    spread: "compact",
    speed: "unknown",
  },
  allowedTermIds: ["kire", "atoaji"],
};

describe("backend AI sensory interpretation contract", () => {
  it("requires the shadow interpretation while retaining legacy grounding fields", () => {
    expect(responseSchema.properties.sensoryInterpretation).toBeDefined();
    expect(responseSchema.required).toEqual([
      "sensoryInterpretation",
      "sensoryExpressions",
      "candidateTermIds",
      "reason",
    ]);
  });

  it("keeps the provider schema within Bedrock structured-output array support", () => {
    expect(responseSchema.properties.sensoryExpressions).not.toHaveProperty("maxItems");
    expect(responseSchema.properties.candidateTermIds).not.toHaveProperty("maxItems");
    expect(responseSchema.properties.sensoryExpressions.const).toEqual([]);
    expect(responseSchema.properties.candidateTermIds.const).toEqual([]);
  });

  it("accepts Primary unknown values and optional Experimental values", () => {
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        experimentalProfile: {
          softness: "soft",
          symmetry: "balanced",
          verticality: "neutral",
          approach: "unknown",
        },
      }).ok,
    ).toBe(true);
  });

  it("rejects missing axes, invalid enums, arbitrary keys, and unsupported outcomes", () => {
    const missing = Object.fromEntries(
      Object.entries(primaryProfile).filter(([key]) => key !== "roundness"),
    );
    expect(validateSensoryInterpretation({ ...interpreted, semanticProfile: missing }).ok).toBe(
      false,
    );
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        semanticProfile: { ...primaryProfile, expansion: "mostly-expansive" },
      }).ok,
    ).toBe(false);
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        semanticProfile: { ...primaryProfile, mood: "calm" },
      }).ok,
    ).toBe(false);
    expect(validateSensoryInterpretation({ outcome: "provider_failure" }).ok).toBe(false);
  });

  it("accepts ambiguous and insufficient without fabricating a profile", () => {
    expect(
      validateSensoryInterpretation({
        outcome: "ambiguous",
        sensoryExpression: "複数の感じが重なっています",
      }).ok,
    ).toBe(true);
    expect(validateSensoryInterpretation({ outcome: "insufficient" }).ok).toBe(true);
  });

  it("keeps AI terms and presentation prose out of reviewed grounding", () => {
    const result = validateModelResponse(
      {
        sensoryInterpretation: {
          ...interpreted,
          experimentalProfile: { softness: "soft" },
        },
        sensoryExpressions: ["きれいに切れる感じ"],
        candidateTermIds: ["kire"],
        reason: "モデルの解釈",
      },
      new Set(bodyRequest.allowedTermIds),
      bodyRequest,
    );
    expect(result.candidateTermIds).toEqual([]);
    expect(result.sensoryInterpretation).toEqual({
      ...interpreted,
      experimentalProfile: { softness: "soft" },
    });
  });

  it("does not mutate or authorize from the interpretation object", () => {
    const input = {
      ...interpreted,
      semanticProfile: { ...primaryProfile },
    };
    const before = JSON.stringify(input);
    const result = applyReviewedGrounding(
      {
        sensoryInterpretation: input,
        sensoryExpressions: [],
        candidateTermIds: ["kire"],
        reason: "モデルの解釈",
      },
      bodyRequest,
      new Set(bodyRequest.allowedTermIds),
    );
    expect(JSON.stringify(input)).toBe(before);
    expect(result.candidateTermIds).toEqual([]);
  });
});
