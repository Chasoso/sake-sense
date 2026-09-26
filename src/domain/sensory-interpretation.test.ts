import { describe, expect, it } from "vitest";
import {
  validateSensoryInterpretation,
  type AiSensoryInterpretation,
  type PrimarySemanticProfile,
} from "./sensory-interpretation";
import { applyReviewedSemanticGrounding, getSelectableSensoryTermIds } from "./sensory-bridge";
import { findSakeProductMatches } from "./sake-product-matching";

const primaryProfile: PrimarySemanticProfile = {
  timeQuality: "sustained",
  weightQuality: "light",
  flowQuality: "free",
  directness: "indirect",
  persistence: "lingering",
  resolution: "gradual",
  continuity: "continuous",
  rhythmicity: "unknown",
  expansion: "expansive",
  spread: "spreading",
  smoothness: "smooth",
  roundness: "unknown",
};

const interpreted: AiSensoryInterpretation = {
  outcome: "interpreted",
  sensoryExpression: "ゆっくり広がりながら、なめらかに続く感じ",
  semanticProfile: primaryProfile,
};

describe("AI sensory interpretation contract", () => {
  it("accepts an interpreted result with all Primary axes", () => {
    expect(validateSensoryInterpretation(interpreted).ok).toBe(true);
  });

  it("accepts unknown values and an optional Experimental profile", () => {
    const result = validateSensoryInterpretation({
      ...interpreted,
      semanticProfile: { ...primaryProfile, timeQuality: "unknown" },
      experimentalProfile: {
        softness: "soft",
        symmetry: "unknown",
        verticality: "neutral",
        approach: "retreating",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts omitted Experimental axes and rejects invalid enums or keys", () => {
    expect(validateSensoryInterpretation(interpreted).ok).toBe(true);
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        semanticProfile: { ...primaryProfile, smoothness: "mostly-smooth" },
      }).ok,
    ).toBe(false);
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        experimentalProfile: { mood: "calm" },
      }).ok,
    ).toBe(false);
  });

  it("requires every Primary axis for interpreted results", () => {
    const missing = Object.fromEntries(
      Object.entries(primaryProfile).filter(([key]) => key !== "roundness"),
    );
    expect(validateSensoryInterpretation({ ...interpreted, semanticProfile: missing }).ok).toBe(
      false,
    );
  });

  it("rejects unsupported neutral, confidence, mixed, and arbitrary top-level fields", () => {
    expect(
      validateSensoryInterpretation({
        ...interpreted,
        semanticProfile: { ...primaryProfile, timeQuality: "neutral" },
      }).ok,
    ).toBe(false);
    expect(validateSensoryInterpretation({ ...interpreted, confidence: 0.82 }).ok).toBe(false);
    expect(validateSensoryInterpretation({ ...interpreted, mixed: true }).ok).toBe(false);
    expect(validateSensoryInterpretation({ ...interpreted, mood: "calm" }).ok).toBe(false);
  });

  it("distinguishes ambiguous and insufficient semantic states", () => {
    expect(
      validateSensoryInterpretation({
        outcome: "ambiguous",
        sensoryExpression: "複数の感じが重なっています",
      }).ok,
    ).toBe(true);
    expect(validateSensoryInterpretation({ outcome: "insufficient" }).ok).toBe(true);
    expect(
      validateSensoryInterpretation({ outcome: "ambiguous", semanticProfile: primaryProfile }).ok,
    ).toBe(false);
    expect(validateSensoryInterpretation({ outcome: "provider_failure" }).ok).toBe(false);
  });

  it("fails malformed output safely", () => {
    expect(validateSensoryInterpretation(null).ok).toBe(false);
    expect(validateSensoryInterpretation("not json").ok).toBe(false);
    expect(validateSensoryInterpretation({ outcome: "interpreted" }).ok).toBe(false);
  });

  it("keeps interpretation prose and Experimental fields out of current term grounding", () => {
    const response = applyReviewedSemanticGrounding(
      {
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
        allowedTermIds: getSelectableSensoryTermIds(),
      },
      {
        sensoryInterpretation: {
          ...interpreted,
          experimentalProfile: { softness: "soft" },
        },
        sensoryExpressions: ["きれいに切れる感じ"],
        candidateTermIds: ["kire"],
        unmappedFeatures: [],
        reason: "provider output",
      },
    );

    expect(response.candidateTermIds).toEqual([]);
    expect(response.sensoryInterpretation?.outcome).toBe("interpreted");
  });

  it("keeps semantic wording and product reachability stable across shadow variants", () => {
    const request = {
      modality: "body" as const,
      input: {
        duration: "short" as const,
        ending: "abrupt" as const,
        expansion: "unknown" as const,
        direction: "unknown" as const,
        repetition: "single" as const,
        participation: "localized" as const,
        spread: "compact" as const,
        speed: "unknown" as const,
      },
      allowedTermIds: getSelectableSensoryTermIds(),
    };
    const makeResponse = (expression: string) =>
      applyReviewedSemanticGrounding(request, {
        sensoryInterpretation: { ...interpreted, sensoryExpression: expression },
        sensoryExpressions: [expression],
        candidateTermIds: ["atoaji"],
        unmappedFeatures: [],
        reason: `AI reason: ${expression}`,
      });

    const first = makeResponse("ゆっくり広がる感じ");
    const second = makeResponse("急に収束する感じ");
    expect(first.sensoryInterpretation?.sensoryExpression).not.toBe(
      second.sensoryInterpretation?.sensoryExpression,
    );
    expect(first.sensoryExpressions).not.toEqual(second.sensoryExpressions);
    expect(first.sensoryExpressions).toEqual([first.sensoryInterpretation?.sensoryExpression]);
    expect(second.sensoryExpressions).toEqual([second.sensoryInterpretation?.sensoryExpression]);
    expect(first.reason).toBe("AI reason: " + first.sensoryInterpretation?.sensoryExpression);
    expect(second.reason).toBe("AI reason: " + second.sensoryInterpretation?.sensoryExpression);
    expect(first.candidateTermIds).toEqual(second.candidateTermIds);
    expect(findSakeProductMatches(first.candidateTermIds)).toEqual(
      findSakeProductMatches(second.candidateTermIds),
    );
  });
});
