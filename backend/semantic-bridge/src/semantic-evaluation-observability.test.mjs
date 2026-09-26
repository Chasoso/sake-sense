import { describe, expect, it } from "vitest";
import {
  buildSemanticEvaluationDiagnostics,
  summarizeSemanticBridgeInput,
} from "./diagnostics.mjs";
import { countRenderableProductMatches } from "./product-match-count.mjs";
import { findSakeProductMatches } from "../../../src/domain/sake-product-matching.ts";

const event = { requestContext: { requestId: "evaluation-request-1" } };
const bodyInput = {
  duration: "short",
  ending: "abrupt",
  expansion: "unknown",
  direction: "lateral",
  repetition: "single",
  participation: "localized",
  spread: "compact",
  speed: "unknown",
};

const interpreted = {
  outcome: "interpreted",
  sensoryExpression: "SENSORY_TEXT_MUST_NOT_BE_LOGGED",
  semanticProfile: {
    timeQuality: "sudden",
    weightQuality: "unknown",
    flowQuality: "unknown",
    directness: "unknown",
    persistence: "brief",
    resolution: "abrupt",
    continuity: "unknown",
    rhythmicity: "unknown",
    expansion: "unknown",
    spread: "unknown",
    smoothness: "unknown",
    roundness: "unknown",
  },
  experimentalProfile: { softness: "unknown" },
};

function evaluation(response, input = bodyInput, modality = "body", productMatchCount = 0) {
  return buildSemanticEvaluationDiagnostics({
    event,
    modality,
    input,
    response,
    productMatchCount,
  });
}

describe("semantic evaluation observability", () => {
  it("summarizes Body compact input without raw payload expansion", () => {
    expect(summarizeSemanticBridgeInput("body", bodyInput)).toEqual(bodyInput);
  });

  it("summarizes Voice with bounded numeric buckets", () => {
    expect(
      summarizeSemanticBridgeInput("voice", {
        durationMs: 1200,
        averageIntensity: 0.4,
        pauseCount: 2,
        endingBehavior: "fading",
      }),
    ).toEqual({
      durationMsBucket: "medium",
      intensityBucket: "medium",
      pauseCount: 2,
      endingBehavior: "fading",
    });
  });

  it("logs interpreted profile, proposals, authorization, correlation, and product count", () => {
    const result = evaluation(
      {
        sensoryInterpretation: interpreted,
        sensoryClassProposals: ["clean-fade"],
        groundingCaseIds: ["legacy-case-for-diagnostics"],
        authorization: [
          { termId: "kire", sensoryClass: "clean-fade", level: "strong", supportCount: 3 },
        ],
        authorizationConflicts: [],
        candidateTermIds: ["kire"],
      },
      bodyInput,
      "body",
      1,
    );
    expect(result).toMatchObject({
      category: "semantic_evaluation",
      eventRequestId: "evaluation-request-1",
      modality: "body",
      semanticOutcome: "interpreted",
      sensoryClassProposals: ["clean-fade"],
      authorizedTermIds: ["kire"],
      productMatchCount: 1,
      authorization: [{ termId: "kire", level: "strong", supportCount: 3 }],
      legacyGroundingInvolvement: "diagnostic-only",
      semanticAuthorizationSource: "primary-semantic-profile",
      fallbackCategory: "semantic-authorization",
    });
    expect(result.semanticProfile).toEqual(interpreted.semanticProfile);
    expect(result.experimentalProfile).toEqual(interpreted.experimentalProfile);
  });

  it.each(["ambiguous", "insufficient"])("does not fabricate a profile for %s", (outcome) => {
    const result = evaluation({
      sensoryInterpretation: { outcome },
      sensoryClassProposals: [],
      authorization: [],
      authorizationConflicts: [],
      candidateTermIds: [],
    });
    expect(result.semanticOutcome).toBe(outcome);
    expect(result).not.toHaveProperty("semanticProfile");
    expect(result).not.toHaveProperty("experimentalProfile");
  });

  it("marks responses without semantic interpretation as non-authoritative", () => {
    const result = evaluation({
      sensoryExpressions: ["legacy presentation"],
      candidateTermIds: [],
    });
    expect(result.legacyGroundingInvolvement).toBe("none");
    expect(result.semanticAuthorizationSource).toBe("none");
    expect(result.fallbackCategory).toBe("no-semantic-interpretation");
  });

  it("preserves authorization level, support count, and conflict metadata", () => {
    const result = evaluation({
      sensoryInterpretation: interpreted,
      sensoryClassProposals: ["light-delicate", "rich-full"],
      authorization: [],
      authorizationConflicts: [{ termIds: ["tanrei", "nojun"], resolution: "same_level_conflict" }],
      candidateTermIds: [],
    });
    expect(result.authorizationConflicts).toEqual([
      { termIds: ["tanrei", "nojun"], resolution: "same_level_conflict" },
    ]);
    expect(result.authorizedTermIds).toEqual([]);
  });

  it("distinguishes authorized-term/product-zero from no-authorization/product-zero", () => {
    const authorizedButUnavailable = evaluation({
      sensoryInterpretation: interpreted,
      sensoryClassProposals: ["light-delicate"],
      authorization: [
        { termId: "tanrei", sensoryClass: "light-delicate", level: "strong", supportCount: 2 },
      ],
      authorizationConflicts: [],
      candidateTermIds: ["tanrei"],
    });
    const noAuthorization = evaluation({
      sensoryInterpretation: interpreted,
      sensoryClassProposals: [],
      authorization: [],
      authorizationConflicts: [],
      candidateTermIds: [],
    });
    expect(authorizedButUnavailable).toMatchObject({
      authorizedTermIds: ["tanrei"],
      productMatchCount: 0,
    });
    expect(noAuthorization).toMatchObject({ authorizedTermIds: [], productMatchCount: 0 });
  });

  it("uses the existing product safety boundary for count-only diagnostics", () => {
    for (const candidateTermIds of [
      ["kire"],
      ["tanrei"],
      ["nojun"],
      [],
      ["sanmi", "unknown-term"],
    ]) {
      expect(countRenderableProductMatches(candidateTermIds)).toBe(
        findSakeProductMatches(candidateTermIds).length,
      );
    }
    expect(countRenderableProductMatches(["kire"])).toBeGreaterThan(0);
    expect(countRenderableProductMatches(["tanrei"])).toBe(0);
    expect(countRenderableProductMatches(["nojun"])).toBe(0);
    expect(countRenderableProductMatches([])).toBe(0);
  });

  it("does not include free text, raw media, or secrets", () => {
    const log = JSON.stringify(
      evaluation({
        sensoryInterpretation: interpreted,
        sensoryClassProposals: [],
        authorization: [],
        authorizationConflicts: [],
        candidateTermIds: [],
        reason: "REASON_MUST_NOT_BE_LOGGED",
        rawAudio: "RAW_AUDIO_MUST_NOT_BE_LOGGED",
        poseHistory: "RAW_POSE_MUST_NOT_BE_LOGGED",
        credentialValue: "CREDENTIAL_MUST_NOT_BE_LOGGED",
      }),
    );
    expect(log).not.toContain("SENSORY_TEXT_MUST_NOT_BE_LOGGED");
    expect(log).not.toContain("REASON_MUST_NOT_BE_LOGGED");
    expect(log).not.toContain("RAW_AUDIO_MUST_NOT_BE_LOGGED");
    expect(log).not.toContain("RAW_POSE_MUST_NOT_BE_LOGGED");
    expect(log).not.toContain("CREDENTIAL_MUST_NOT_BE_LOGGED");
  });

  it("keeps the event bounded", () => {
    const result = evaluation({
      sensoryInterpretation: interpreted,
      sensoryClassProposals: ["clean-fade", "smooth-flow"],
      authorization: Array.from({ length: 100 }, (_, index) => ({
        termId: `term-${index}`,
        sensoryClass: "clean-fade",
        level: "supported",
        supportCount: 1,
      })),
      authorizationConflicts: [],
      candidateTermIds: [],
    });
    expect(result.sensoryClassProposals).toHaveLength(2);
    expect(result.authorization.length).toBeLessThanOrEqual(100);
    expect(JSON.stringify(result).length).toBeLessThan(20_000);
  });
});
