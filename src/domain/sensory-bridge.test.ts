import { describe, expect, it, vi } from "vitest";
import {
  applyReviewedSemanticGrounding,
  buildSensoryBridgeInput,
  buildSensoryBridgeInstruction,
  createFallbackSensoryBridgeResponse,
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
  getSelectableSensoryTermIds,
  presentSensoryBridgeProvider,
  serializeSensoryDictionaryContext,
  serializeSensoryBridgeRequest,
  SEMANTIC_BRIDGE_HTTP_TIMEOUT_MS,
  validateSensoryBridgeResponse,
} from "./sensory-bridge";
import type { BodyMovementFeatures } from "./body";

const baseFeatures: BodyMovementFeatures = {
  frameCount: 10,
  captureDurationMs: 3000,
  activeDurationMs: 2000,
  totalMovement: 3,
  averageSpeed: 0.002,
  peakSpeed: 0.01,
  hasSustainedFastMovement: false,
  spread: 1.6,
  hasMeaningfulMovement: true,
  activeJointCount: 4,
  endingSpeedRatio: 0.5,
  endingBehavior: "gradual",
  motionShape: {
    expansion: "unknown",
    dominantDirection: "lateral",
    repetition: "repeated",
    participation: "broad",
  },
};

describe("MVP sensory bridge vocabulary boundary", () => {
  it("uses a bounded HTTP timeout longer than the Lambda processing envelope", () => {
    expect(SEMANTIC_BRIDGE_HTTP_TIMEOUT_MS).toBe(35_000);
    expect(SEMANTIC_BRIDGE_HTTP_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("aborts an HTTP request after the bounded default timeout", async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const request = {
        modality: "body" as const,
        input: buildSensoryBridgeInput(baseFeatures),
        allowedTermIds: getSelectableSensoryTermIds(),
      };
      const pending = createHttpSensoryBridgeProvider(
        "https://example.test/semantic-bridge",
      ).interpret(request);
      const aborted = expect(pending).rejects.toThrow("Aborted");
      await vi.advanceTimersByTimeAsync(SEMANTIC_BRIDGE_HTTP_TIMEOUT_MS);
      await aborted;
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.test/semantic-bridge",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    } finally {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    }
  });

  it("serializes the six reviewed selectable terms", () => {
    const context = serializeSensoryDictionaryContext();
    expect(context.map((entry) => entry.id)).toEqual([
      "atoaji",
      "kire",
      "nameraka",
      "marui",
      "tanrei",
      "nojun",
    ]);
    expect(context.find((entry) => entry.id === "kire")).toMatchObject({
      displayTerm: "きれ",
      parentTermId: "atoaji",
      sourceCategory: "aftertaste",
    });
    expect(context.every((entry) => !("provenance" in entry))).toBe(true);
  });

  it("excludes reference-only terms from serialization, validation, and the instruction", () => {
    const allowed = getSelectableSensoryTermIds();
    for (const id of ["sanmi", "umami", "amami"]) {
      expect(allowed).not.toContain(id);
      expect(
        validateSensoryBridgeResponse({
          sensoryExpressions: [],
          candidateTermIds: [id],
          unmappedFeatures: [],
          reason: "候補外です",
        }).ok,
      ).toBe(false);
    }
    const instruction = buildSensoryBridgeInstruction({
      modality: "body",
      input: buildSensoryBridgeInput(baseFeatures),
      allowedTermIds: allowed,
    });
    expect(instruction).toContain("nojun");
    expect(instruction).not.toContain("weight:heavy");
    expect(instruction).not.toContain("shape:sharp");
  });

  it("serializes only derived request data and sends it through the HTTP provider", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      expect(init?.method).toBe("POST");
      const body = String(init?.body);
      expect(body).toContain('"allowedTermIds"');
      for (const forbidden of [
        "landmark",
        "video",
        "audio",
        "samples",
        "displayTerm",
        "definitionSummary",
        "provenance",
        "sourceCategory",
      ]) {
        expect(body).not.toContain(forbidden);
      }
      return new Response(
        JSON.stringify({
          sensoryExpressions: [],
          candidateTermIds: [],
          unmappedFeatures: [],
          reason: "候補なしです",
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const request = {
        modality: "body" as const,
        input: buildSensoryBridgeInput(baseFeatures),
        allowedTermIds: getSelectableSensoryTermIds(),
      };
      expect(serializeSensoryBridgeRequest(request)).not.toContain("definitionSummary");
      const response = await createHttpSensoryBridgeProvider(
        "https://example.test/semantic-bridge",
      ).interpret(request);
      expect(validateSensoryBridgeResponse(response).ok).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps fixture, fallback, and AI presentation distinct", () => {
    expect(presentSensoryBridgeProvider("fixture").heading).toContain("ローカル");
    expect(presentSensoryBridgeProvider("fallback").explanation).not.toContain("AIは");
    expect(presentSensoryBridgeProvider("ai").heading).toContain("AI");
  });

  it("accepts zero candidates and rejects malformed, unknown, duplicate, and extra responses", () => {
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: ["ゆらぎながら続く感じ"],
        candidateTermIds: [],
        unmappedFeatures: ["direction:lateral"],
        reason: "候補を絞れません",
      }).ok,
    ).toBe(true);
    expect(validateSensoryBridgeResponse("not json").ok).toBe(false);
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["invented"],
        unmappedFeatures: [],
        reason: "候補外です",
      }).ok,
    ).toBe(false);
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["kire", "kire"],
        unmappedFeatures: [],
        reason: "重複です",
      }).ok,
    ).toBe(false);
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: [],
        unmappedFeatures: [],
        reason: "余分です",
        score: 1,
      } as never).ok,
    ).toBe(false);
  });

  it("accepts backend semantic authorization metadata without deriving terms from free text", () => {
    const response = validateSensoryBridgeResponse({
      sensoryInterpretation: {
        outcome: "interpreted",
        sensoryExpression: "縺吶▲縺ｨ謚慕ｼｱ縺ｫ蜿取據縺吶ｋ諢溘§",
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
      },
      sensoryClassProposals: ["clean-fade"],
      sensoryExpressions: ["free text does not authorize terms"],
      candidateTermIds: ["kire"],
      unmappedFeatures: [],
      reason: "譁ｰ縺励＞諢溘§",
      authorization: [
        { termId: "kire", sensoryClass: "clean-fade", level: "strong", supportCount: 2 },
      ],
      authorizationConflicts: [],
    });
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.value.candidateTermIds).toEqual(["kire"]);
  });

  it("fails closed for malformed semantic authorization metadata", () => {
    const base = {
      sensoryInterpretation: {
        outcome: "interpreted" as const,
        sensoryExpression: "縺吶▲縺ｨ謚慕ｼｱ縺ｫ蜿取據縺吶ｋ諢溘§",
        semanticProfile: {
          timeQuality: "unknown" as const,
          weightQuality: "unknown" as const,
          flowQuality: "unknown" as const,
          directness: "unknown" as const,
          persistence: "unknown" as const,
          resolution: "unknown" as const,
          continuity: "unknown" as const,
          rhythmicity: "unknown" as const,
          expansion: "unknown" as const,
          spread: "unknown" as const,
          smoothness: "unknown" as const,
          roundness: "unknown" as const,
        },
      },
      sensoryClassProposals: [],
      sensoryExpressions: [],
      candidateTermIds: [],
      unmappedFeatures: [],
      reason: "譁ｰ縺励＞諢溘§",
      authorization: [],
      authorizationConflicts: [],
    };
    for (const authorization of [null, ["bad"], [{}]]) {
      expect(() =>
        validateSensoryBridgeResponse({ ...base, authorization } as never),
      ).not.toThrow();
      expect(validateSensoryBridgeResponse({ ...base, authorization } as never).ok).toBe(false);
    }
    for (const authorizationConflicts of [null, [{}]]) {
      expect(() =>
        validateSensoryBridgeResponse({ ...base, authorizationConflicts } as never),
      ).not.toThrow();
      expect(validateSensoryBridgeResponse({ ...base, authorizationConflicts } as never).ok).toBe(
        false,
      );
    }
  });

  it("derives Body fixture candidates only through approved expression links", async () => {
    const provider = createFixtureSensoryBridgeProvider();
    const cases = [
      {
        input: buildSensoryBridgeInput({
          ...baseFeatures,
          activeDurationMs: 500,
          endingBehavior: "abrupt",
          motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
        }),
        candidateTermIds: ["kire"],
      },
      {
        input: buildSensoryBridgeInput({
          ...baseFeatures,
          activeDurationMs: 2500,
          endingBehavior: "gradual",
          motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
        }),
        candidateTermIds: [],
      },
      { input: buildSensoryBridgeInput(baseFeatures), candidateTermIds: [] },
    ];
    for (const { input, candidateTermIds } of cases) {
      const response = await provider.interpret({
        modality: "body",
        input,
        allowedTermIds: getSelectableSensoryTermIds(),
      });
      const validated = validateSensoryBridgeResponse(response);
      expect(validated.ok).toBe(true);
      if (validated.ok) expect(validated.value.candidateTermIds).toEqual(candidateTermIds);
    }
  });

  it("uses the support-case expression before deriving an approved term", async () => {
    const provider = createFixtureSensoryBridgeProvider();
    const shortAbrupt = await provider.interpret({
      modality: "body",
      input: buildSensoryBridgeInput({
        ...baseFeatures,
        activeDurationMs: 500,
        endingBehavior: "abrupt",
        motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
      }),
      allowedTermIds: getSelectableSensoryTermIds(),
    });
    const validated = validateSensoryBridgeResponse(shortAbrupt);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.sensoryExpressions).toEqual(["すっと引いていく感じ"]);
    expect(validated.value.candidateTermIds).toEqual(["kire"]);
  });

  it("uses no candidate in the deterministic Voice fading fixture path", async () => {
    const response = await createFixtureSensoryBridgeProvider().interpret({
      modality: "voice",
      input: { durationMs: 1200, averageIntensity: 0.4, pauseCount: 1, endingBehavior: "fading" },
      allowedTermIds: getSelectableSensoryTermIds(),
    });
    const validated = validateSensoryBridgeResponse(response);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.sensoryExpressions).toEqual(["ゆっくり落ち着いていく感じ"]);
      expect(validated.value.candidateTermIds).toEqual([]);
    }
  });

  it("separates observed, interpretation, unmapped, and unused provenance after semantic grounding", () => {
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
        speed: "sustained-fast" as const,
      },
      allowedTermIds: getSelectableSensoryTermIds(),
    };
    const response = applyReviewedSemanticGrounding(request, {
      sensoryExpressions: ["モデルの表現"],
      candidateTermIds: ["atoaji"],
      unmappedFeatures: [],
      reason: "モデル理由",
    });
    expect(response).toMatchObject({
      candidateTermIds: ["kire"],
      interpretationEvidence: ["duration:short", "ending:abrupt"],
      unmappedFeatures: ["speed:sustained-fast"],
      groundingExpressionIds: ["clean-fade"],
    });
    expect(response.observedFeatures).toContain("direction:unknown");
    expect(response.unusedFeatures).toContain("direction:unknown");
  });

  it("provides a safe observation-only fallback", () => {
    const fallback = createFallbackSensoryBridgeResponse(buildSensoryBridgeInput(baseFeatures));
    expect(fallback.candidateTermIds).toEqual([]);
    expect(fallback.sensoryExpressions).toEqual([]);
    expect(fallback.unmappedFeatures).toContain("direction:lateral");
  });
});
