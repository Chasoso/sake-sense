import { describe, expect, it } from "vitest";
import {
  buildSensoryBridgeInput,
  buildSensoryBridgeInstruction,
  createFallbackSensoryBridgeResponse,
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
  getSelectableSensoryTermIds,
  presentSensoryBridgeProvider,
  serializeSensoryDictionaryContext,
  serializeSensoryBridgeRequest,
  validateSensoryBridgeResponse,
} from "./sensory-bridge";
import type { BodyMovementFeatures } from "./body";
import { getSensoryExpressionDisplayText } from "./sensory-expressions";

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
  it("serializes only the four reviewed selectable terms", () => {
    const context = serializeSensoryDictionaryContext();
    expect(context.map((entry) => entry.id)).toEqual(["atoaji", "kire", "nameraka", "marui"]);
    expect(context.find((entry) => entry.id === "kire")).toMatchObject({
      displayTerm: "きれ",
      parentTermId: "atoaji",
      sourceCategory: "aftertaste",
    });
    expect(context.every((entry) => !("provenance" in entry))).toBe(true);
  });

  it("excludes reference-only terms from serialization, validation, and the instruction", () => {
    const allowed = getSelectableSensoryTermIds();
    for (const id of ["sanmi", "umami", "amami", "tanrei", "nojun"]) {
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
    expect(instruction).not.toContain("nojun");
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

  it("uses no candidate in every deterministic Body fixture path", async () => {
    const provider = createFixtureSensoryBridgeProvider();
    const cases = [
      buildSensoryBridgeInput({
        ...baseFeatures,
        activeDurationMs: 500,
        endingBehavior: "abrupt",
        motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
      }),
      buildSensoryBridgeInput({
        ...baseFeatures,
        activeDurationMs: 2500,
        endingBehavior: "gradual",
        motionShape: { ...baseFeatures.motionShape, dominantDirection: "unknown" },
      }),
      buildSensoryBridgeInput(baseFeatures),
    ];
    for (const input of cases) {
      const response = await provider.interpret({
        modality: "body",
        input,
        allowedTermIds: getSelectableSensoryTermIds(),
      });
      const validated = validateSensoryBridgeResponse(response);
      expect(validated.ok).toBe(true);
      if (validated.ok) expect(validated.value.candidateTermIds).toEqual([]);
    }
  });

  it("resolves legacy fixture display text from the reviewed expression dataset", async () => {
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
    expect(validated.value.sensoryExpressions).toEqual([
      getSensoryExpressionDisplayText("clean-fade"),
    ]);
    expect(validated.value.candidateTermIds).toEqual([]);
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
      expect(validated.value.sensoryExpressions).toEqual(["余韻が残る感じ"]);
      expect(validated.value.candidateTermIds).toEqual([]);
    }
  });

  it("provides a safe observation-only fallback", () => {
    const fallback = createFallbackSensoryBridgeResponse(buildSensoryBridgeInput(baseFeatures));
    expect(fallback.candidateTermIds).toEqual([]);
    expect(fallback.sensoryExpressions).toEqual([]);
    expect(fallback.unmappedFeatures).toContain("direction:lateral");
  });
});
