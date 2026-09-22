import { describe, expect, it } from "vitest";
import { responseKeys, responseSchema } from "./schema.mjs";
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
    expect(responseSchema.properties.sensoryExpressions).not.toHaveProperty("const");
    expect(responseSchema.properties.candidateTermIds).not.toHaveProperty("const");
  });

  it("keeps schema properties and validator response keys aligned", () => {
    expect(responseKeys).toEqual(Object.keys(responseSchema.properties));
  });

  it("validates finite sensory class proposals and uses the reviewed route result", () => {
    const result = validateModelResponse(
      {
        sensoryInterpretation: {
          ...interpreted,
          semanticProfile: {
            ...primaryProfile,
            timeQuality: "sudden",
            persistence: "brief",
            resolution: "abrupt",
          },
        },
        sensoryClassProposals: ["clean-fade"],
        sensoryExpressions: [],
        candidateTermIds: ["atoaji"],
        reason: "譁ｰ縺励＞諢溘§",
      },
      new Set(bodyRequest.allowedTermIds),
      bodyRequest,
    );
    expect(result.candidateTermIds).toEqual(["kire"]);
    expect(result.authorization).toMatchObject([
      { termId: "kire", sensoryClass: "clean-fade", level: "strong" },
    ]);
  });

  it.each([
    ["unknown-class"],
    ["smooth-flow", "clean-fade", "light-delicate"],
    ["unmapped", "clean-fade"],
  ])("rejects invalid sensory class proposal %s", (...proposals) => {
    expect(() =>
      validateModelResponse(
        {
          sensoryInterpretation: interpreted,
          sensoryClassProposals: proposals,
          sensoryExpressions: [],
          candidateTermIds: [],
          reason: "譁ｰ縺励＞諢溘§",
        },
        new Set(bodyRequest.allowedTermIds),
        bodyRequest,
      ),
    ).toThrow();
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

  it("accepts optional unmappedFeatures while keeping reviewed grounding authoritative", () => {
    const result = validateModelResponse(
      {
        sensoryExpressions: ["観測された印象"],
        candidateTermIds: ["kire"],
        unmappedFeatures: ["duration:lingering"],
        reason: "観測結果です",
      },
      new Set(bodyRequest.allowedTermIds),
      bodyRequest,
    );
    expect(result.candidateTermIds).toEqual([]);
    expect(result.unmappedFeatures).not.toEqual(["duration:lingering"]);
  });

  it("rejects non-string unmappedFeatures items and still rejects unknown keys", () => {
    expect(() =>
      validateModelResponse(
        {
          sensoryExpressions: [],
          candidateTermIds: [],
          unmappedFeatures: [123],
          reason: "観測結果です",
        },
        new Set(bodyRequest.allowedTermIds),
        bodyRequest,
      ),
    ).toThrow();
    expect(() =>
      validateModelResponse(
        {
          sensoryExpressions: [],
          candidateTermIds: [],
          unmappedFeatures: [],
          unexpectedField: "extra value",
          reason: "観測結果です",
        },
        new Set(bodyRequest.allowedTermIds),
        bodyRequest,
      ),
    ).toThrow();
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

  it("keeps semantic authorization and legacy presentation decoupled", () => {
    const noLegacyMatchRequest = {
      modality: "body",
      input: {
        duration: "short",
        ending: "continued",
        expansion: "unknown",
        direction: "upward",
        repetition: "single",
        participation: "localized",
        spread: "compact",
        speed: "unknown",
      },
      allowedTermIds: ["nameraka"],
    };
    const result = validateModelResponse(
      {
        sensoryInterpretation: {
          ...interpreted,
          semanticProfile: {
            ...primaryProfile,
            smoothness: "smooth",
            continuity: "continuous",
          },
        },
        sensoryClassProposals: ["smooth-flow"],
        sensoryExpressions: [],
        candidateTermIds: [],
        reason: "譁ｰ縺励＞諢溘§",
      },
      new Set(noLegacyMatchRequest.allowedTermIds),
      noLegacyMatchRequest,
    );
    expect(result.candidateTermIds).toEqual(["nameraka"]);
    expect(result.sensoryExpressions).toEqual([]);
    expect(result.reason).not.toBe("隴・ｽｰ邵ｺ蜉ｱ・櫁ｫ｢貅伉ｧ");
    expect(result.reason).toEqual(expect.any(String));
    expect(result.authorization).toMatchObject([
      { termId: "nameraka", sensoryClass: "smooth-flow", level: "strong" },
    ]);
  });
});
