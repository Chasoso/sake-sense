import { describe, expect, it } from "vitest";
import fixtureData from "../../backend/semantic-bridge/eval/body-voice-evaluation.v0.1.json" with { type: "json" };
import {
  compareEvaluationReports,
  classifyTermAuthorization,
  integrateComparisonReviewQueue,
  runSemanticEvaluation,
  summarizeReachMetrics,
  validateEvaluationFixtures,
} from "./run-semantic-evaluation.mjs";
import {
  normalizeEvaluatorResult,
  parseEvaluatorResponse,
  validateEvaluatorResult,
} from "./semantic-evaluator.mjs";

describe("semantic evaluation harness", () => {
  it("validates the representative Body and Voice fixture set", () => {
    expect(validateEvaluationFixtures(fixtureData.fixtures).count).toBe(20);
    expect(fixtureData.fixtures.filter((fixture) => fixture.modality === "body")).toHaveLength(10);
    expect(fixtureData.fixtures.filter((fixture) => fixture.modality === "voice")).toHaveLength(10);
  });

  it("produces stable offline output from the reviewed deterministic pipeline", async () => {
    const first = await runSemanticEvaluation();
    const second = await runSemanticEvaluation();
    expect(first).toEqual(second);
    expect(first.summary.totalFixtureCount).toBe(20);
    expect(first.baselineKind).toBe("offline-deterministic-grounding");
    expect(first.baselineNote).toContain("not production-equivalent");
    expect(first.summary.deterministicContractFailureCount).toBe(0);
    expect(first.summary.insufficientCount + first.summary.ambiguousCount).toBeGreaterThan(0);
    expect(
      first.cases.find((entry) => entry.fixtureId === "body-short-abrupt-control"),
    ).toMatchObject({
      interpretationOutcome: "interpreted",
      authorizedTermIds: ["kire"],
    });
  });

  it("keeps evaluator output separate from deterministic term authorization", async () => {
    const report = await runSemanticEvaluation({
      judge: async () => ({
        dimensions: Object.fromEntries(
          [
            "semanticConsistency",
            "unsupportedInference",
            "ambiguityHandling",
            "profileTextConsistency",
            "wordingQuality",
          ].map((dimension) => [dimension, { status: "pass", rationale: "reviewed" }]),
        ),
      }),
    });
    expect(report.summary.evaluator.semanticConsistency.pass).toBe(20);
    expect(
      report.cases.every((entry) => entry.authorizedTermIds.every((id) => id !== "injected")),
    ).toBe(true);
  });

  it("attributes semantic and reviewed-grounding term reach separately", () => {
    const allowedIds = new Set(["kire", "atoaji"]);
    expect(
      classifyTermAuthorization(
        { authorization: [{ termId: "kire" }], sensoryInterpretation: { outcome: "interpreted" } },
        ["kire"],
        allowedIds,
      ),
    ).toEqual({
      semanticAuthorizedTermIds: ["kire"],
      legacyGroundingTermIds: [],
      termAuthorizationSource: "semantic-authorization",
    });
    expect(classifyTermAuthorization({}, ["atoaji"], allowedIds)).toEqual({
      semanticAuthorizedTermIds: [],
      legacyGroundingTermIds: ["atoaji"],
      termAuthorizationSource: "reviewed-support-grounding",
    });
    expect(classifyTermAuthorization({}, [], allowedIds).termAuthorizationSource).toBe("none");
  });

  it("fails safely on malformed evaluator output", () => {
    expect(validateEvaluatorResult({ dimensions: {} }).ok).toBe(false);
    const result = normalizeEvaluatorResult({ dimensions: {} });
    expect(result.status).toBe("malformed");
    expect(Object.values(result.dimensions).every((dimension) => dimension.status === "fail")).toBe(
      true,
    );
    expect(result.responseShape).toMatchObject({
      topLevelType: "object",
      topLevelKeys: ["dimensions"],
      hasDimensions: true,
      dimensionsKeys: [],
    });
  });

  it("accepts plain and fenced JSON evaluator responses", () => {
    const response = { dimensions: { semanticConsistency: { status: "pass", rationale: "ok" } } };
    const fullResponse = {
      dimensions: Object.fromEntries(
        [
          "semanticConsistency",
          "unsupportedInference",
          "ambiguityHandling",
          "profileTextConsistency",
          "wordingQuality",
        ].map((dimension) => [dimension, { status: "pass", rationale: "ok" }]),
      ),
    };
    expect(parseEvaluatorResponse(JSON.stringify(fullResponse))).toEqual(fullResponse);
    expect(
      parseEvaluatorResponse(["```json", JSON.stringify(fullResponse), "```"].join("\n")),
    ).toEqual(fullResponse);
    expect(parseEvaluatorResponse(JSON.stringify(response))).not.toBeNull();
  });

  it("routes malformed, empty, and invalid evaluator responses through fail-safe normalization", () => {
    for (const response of [
      "not json",
      "",
      "   ",
      ["```json", '{"broken":', "```"].join("\n"),
      "null",
    ]) {
      const parsed = parseEvaluatorResponse(response);
      const normalized = normalizeEvaluatorResult(parsed);
      expect(normalized.status).toBe("malformed");
      expect(
        Object.values(normalized.dimensions).every((dimension) => dimension.status === "fail"),
      ).toBe(true);
    }
  });

  it("reports provider contract code and path without storing provider output", async () => {
    const report = await runSemanticEvaluation({
      provider: async () => {
        const error = new Error("invalid ambiguous sensory interpretation");
        error.code = "invalid_ambiguous_interpretation";
        error.path = "sensoryInterpretation.outcome";
        throw error;
      },
    });
    const failed = report.cases.find((entry) => entry.fixtureId === "body-expanding");
    expect(failed.deterministicContract).toMatchObject({
      status: "failed",
      code: "invalid_ambiguous_interpretation",
      path: "sensoryInterpretation.outcome",
    });
    expect(JSON.stringify(failed)).not.toContain("provider output");
  });

  it("provides a compact human review summary for evaluator failures", async () => {
    const report = await runSemanticEvaluation({
      judge: async () => ({
        dimensions: Object.fromEntries(
          [
            "semanticConsistency",
            "unsupportedInference",
            "ambiguityHandling",
            "profileTextConsistency",
            "wordingQuality",
          ].map((dimension) => [dimension, { status: "fail", rationale: "needs review" }]),
        ),
      }),
    });
    expect(report.summary.evaluatorFailCaseCount).toBe(20);
    expect(report.summary.evaluatorReviewCaseCount).toBe(0);
    expect(report.humanReviewSummary).toHaveLength(20);
    expect(report.humanReviewSummary[0]).toHaveProperty("observableInput");
    expect(JSON.stringify(report.humanReviewSummary)).not.toContain("raw provider response");
  });

  it("separates global and outcome-specific reach metrics", () => {
    expect(
      summarizeReachMetrics([
        { interpretationOutcome: "interpreted", authorizedTermIds: ["kire"], productMatchCount: 1 },
        { interpretationOutcome: "ambiguous", authorizedTermIds: ["kire"], productMatchCount: 1 },
        {
          interpretationOutcome: "insufficient",
          authorizedTermIds: ["atoaji"],
          productMatchCount: 1,
        },
        { interpretationOutcome: "interpreted", authorizedTermIds: [], productMatchCount: 0 },
      ]),
    ).toEqual({
      authorizedTermReachCount: 3,
      productReachCount: 3,
      interpretedAuthorizedTermReachCount: 1,
      interpretedProductReachCount: 1,
      ambiguousWithAuthorizedTermsCount: 1,
      insufficientWithAuthorizedTermsCount: 1,
    });
  });

  it("distinguishes semantic changes from deterministic contract failures", () => {
    const current = {
      cases: [
        {
          fixtureId: "case-1",
          interpretationOutcome: "interpreted",
          semanticProfile: { continuity: "continuous" },
          authorizedTermIds: ["nameraka"],
          productMatchCount: 1,
          deterministicContract: { status: "passed" },
        },
        {
          fixtureId: "case-2",
          deterministicContract: { status: "failed" },
        },
      ],
    };
    const baseline = {
      cases: [
        {
          fixtureId: "case-1",
          interpretationOutcome: "interpreted",
          semanticProfile: { continuity: "interrupted" },
          authorizedTermIds: [],
          productMatchCount: 0,
        },
      ],
    };
    expect(compareEvaluationReports(current, baseline)).toEqual({
      baselineAvailable: true,
      baselineCompatible: true,
      changedCases: [
        { fixtureId: "case-1", reasons: ["semantic-profile", "authorized-terms", "product-reach"] },
      ],
      contractFailures: ["case-2"],
    });
  });

  it("integrates compatible baseline changes into the human review queue", () => {
    const report = {
      baselineKind: "live-production-equivalent",
      cases: [
        {
          fixtureId: "case-1",
          humanReviewReasons: [],
        },
      ],
      summary: { humanReviewQueueCount: 0 },
    };
    const integrated = integrateComparisonReviewQueue(report, {
      baselineAvailable: true,
      baselineCompatible: true,
      changedCases: [
        {
          fixtureId: "case-1",
          reasons: ["outcome", "semantic-profile", "authorized-terms", "product-reach"],
        },
      ],
      contractFailures: [],
    });
    expect(integrated.cases[0].humanReviewReasons).toEqual([
      "baseline-outcome-changed",
      "baseline-semantic-profile-changed",
      "baseline-authorized-terms-changed",
      "baseline-product-reach-changed",
    ]);
    expect(integrated.summary.baselineChangedCaseCount).toBe(1);
    expect(integrated.summary.humanReviewQueueCount).toBe(1);
  });

  it("does not compare offline and live baselines as semantic changes", () => {
    const result = compareEvaluationReports(
      { baselineKind: "live-production-equivalent", cases: [] },
      { baselineKind: "offline-deterministic-grounding", cases: [] },
    );
    expect(result).toMatchObject({
      baselineAvailable: true,
      baselineCompatible: false,
      changedCases: [],
      reason: "baseline-kind-mismatch",
    });
  });
});
