import { describe, expect, it } from "vitest";
import {
  buildSensoryBridgeInput,
  buildSensoryBridgeInstruction,
  createFallbackSensoryBridgeResponse,
  createFixtureSensoryBridgeProvider,
  getSelectableSensoryTermIds,
  presentSensoryBridgeProvider,
  serializeSensoryDictionaryContext,
  serializeSensoryBridgeRequest,
  createHttpSensoryBridgeProvider,
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

describe("EXP-005 sensory bridge", () => {
  it("builds observable-only input without legacy weight conclusions", () => {
    const input = buildSensoryBridgeInput(baseFeatures);
    expect(input).toEqual({
      duration: "lingering",
      ending: "gradual",
      expansion: "unknown",
      direction: "lateral",
      repetition: "repeated",
      participation: "broad",
      spread: "broad",
      speed: "unknown",
    });
    expect(input).not.toHaveProperty("weight");
    expect(input).not.toHaveProperty("candidateTermIds");
  });

  it("serializes only the curated dictionary context", () => {
    const context = serializeSensoryDictionaryContext();
    expect(context.length).toBeGreaterThan(0);
    expect(new Set(context.map((entry) => entry.id)).size).toBe(context.length);
    expect(context.every((entry) => !("provenance" in entry))).toBe(true);
    expect(context.find((entry) => entry.id === "nojun")?.displayTerm).toBe("濃醇");
    expect(context.find((entry) => entry.id === "kire")).toMatchObject({
      displayTerm: "切れが良い",
      definitionSummary: "あと味の切れがよいという評価語。",
      dimensions: [{ dimensionId: "duration", polarity: "short" }],
    });
    expect(context.find((entry) => entry.id === "umami")).toBeUndefined();
  });

  it("builds provider-neutral safety instructions from the closed dictionary", () => {
    const instruction = buildSensoryBridgeInstruction({
      modality: "body",
      input: buildSensoryBridgeInput(baseFeatures),
      dictionaryContext: serializeSensoryDictionaryContext(),
    });
    expect(instruction).toContain("味の測定・判定ではありません");
    expect(instruction).toContain("nojun");
    expect(instruction).toContain("kire");
    expect(instruction).toContain("切れが良い");
    expect(instruction).toContain("あと味の切れがよいという評価語。");
    expect(instruction).toContain("duration:short");
    expect(instruction).toContain("atoaji");
    expect(instruction).toContain("飲み込んだ後に残る味わいを表す語。");
    expect(instruction).toContain("商品推薦");
  });

  it("keeps provider selectable IDs identical to validator IDs", () => {
    const contextIds = serializeSensoryDictionaryContext().map((entry) => entry.id);
    expect(contextIds).toEqual(getSelectableSensoryTermIds());
    for (const id of contextIds) {
      const result = validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: [id],
        unmappedFeatures: [],
        reason: "検証用の理由",
      });
      expect(result.ok).toBe(true);
    }
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["umami"],
        unmappedFeatures: [],
        reason: "検証用の理由",
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("presents fixture, fallback, and future AI providers distinctly", () => {
    expect(presentSensoryBridgeProvider("fixture").heading).toContain("ローカル実験");
    expect(presentSensoryBridgeProvider("fixture").explanation).not.toContain("AIは");
    expect(presentSensoryBridgeProvider("fallback").explanation).toContain("観測した動きのみ");
    expect(presentSensoryBridgeProvider("fallback").explanation).not.toContain("AIは");
    expect(presentSensoryBridgeProvider("ai").heading).toContain("AIによる");
  });

  it("declares the fixture implementation source explicitly", () => {
    expect(createFixtureSensoryBridgeProvider().kind).toBe("fixture");
  });

  it("serializes only derived bridge fields for the production provider", () => {
    const serialized = serializeSensoryBridgeRequest({
      modality: "body",
      input: buildSensoryBridgeInput(baseFeatures),
      dictionaryContext: serializeSensoryDictionaryContext(),
    });
    expect(serialized).not.toContain("landmark");
    expect(serialized).not.toContain("video");
    expect(serialized).not.toContain("audio");
    expect(serialized).toContain('"duration":"lingering"');
    expect(serialized).toContain('"id":"kire"');
  });

  it("uses the explicit AI provider for an HTTP endpoint", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain('"dictionaryContext"');
      return new Response(
        JSON.stringify({
          sensoryExpressions: [],
          candidateTermIds: [],
          unmappedFeatures: ["direction:lateral"],
          reason: "ambiguous observable input",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      const provider = createHttpSensoryBridgeProvider("https://example.test/semantic-bridge");
      expect(provider.kind).toBe("ai");
      const response = await provider.interpret({
        modality: "body",
        input: buildSensoryBridgeInput(baseFeatures),
        dictionaryContext: serializeSensoryDictionaryContext(),
      });
      expect(validateSensoryBridgeResponse(response).ok).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts zero candidates as a valid unmapped response", () => {
    const result = validateSensoryBridgeResponse({
      sensoryExpressions: ["ゆらぎながら続く感じ"],
      candidateTermIds: [],
      unmappedFeatures: ["direction:lateral"],
      reason: "根拠が弱いため候補を選びません。",
    });
    expect(result).toEqual(expect.objectContaining({ ok: true }));
  });

  it("provides a safe no-candidate fallback when a provider is unavailable", () => {
    const fallback = createFallbackSensoryBridgeResponse(buildSensoryBridgeInput(baseFeatures));
    expect(fallback.candidateTermIds).toEqual([]);
    expect(fallback.sensoryExpressions).toEqual([]);
    expect(fallback.reason).toContain("観測した動き");
  });

  it("rejects malformed, unknown, duplicate, and extra response data", () => {
    expect(validateSensoryBridgeResponse("not json")).toEqual({
      ok: false,
      error: "橋渡し応答の形式を確認できませんでした。",
    });
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["invented"],
        unmappedFeatures: [],
        reason: "理由",
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["kire", "kire"],
        unmappedFeatures: [],
        reason: "理由",
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: [],
        unmappedFeatures: [],
        reason: "理由",
        recommendation: "買うべき",
      } as never),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it("keeps repeated lateral sway unmapped in the fixture path", async () => {
    const provider = createFixtureSensoryBridgeProvider();
    const response = await provider.interpret({
      modality: "body",
      input: buildSensoryBridgeInput(baseFeatures),
      dictionaryContext: serializeSensoryDictionaryContext(),
    });
    const validated = validateSensoryBridgeResponse(response);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.candidateTermIds).toEqual([]);
    expect(validated.value.sensoryExpressions).toContain("ゆらぎながら続く感じ");
  });

  it("maps only a grounded short abrupt fixture candidate", async () => {
    const provider = createFixtureSensoryBridgeProvider();
    const response = await provider.interpret({
      modality: "body",
      input: buildSensoryBridgeInput({
        ...baseFeatures,
        activeDurationMs: 500,
        spread: 0.5,
        endingBehavior: "abrupt",
        motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
      }),
      dictionaryContext: serializeSensoryDictionaryContext(),
    });
    const validated = validateSensoryBridgeResponse(response);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.value.candidateTermIds).toEqual(["kire"]);
  });
});
