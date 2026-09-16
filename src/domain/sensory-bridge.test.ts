import { describe, expect, it } from "vitest";
import {
  buildSensoryBridgeInput,
  buildSensoryBridgeInstruction,
  createFixtureSensoryBridgeProvider,
  getSelectableSensoryTermIds,
  serializeSensoryDictionaryContext,
  serializeSensoryBridgeRequest,
  validateSensoryBridgeResponse,
} from "./sensory-bridge";
import type { BodyMovementFeatures } from "./body";

const features: BodyMovementFeatures = {
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
  it("serializes only the four selectable terms", () => {
    const context = serializeSensoryDictionaryContext();
    expect(context.map((entry) => entry.id)).toEqual(["atoaji", "kire", "nameraka", "marui"]);
    expect(context.find((entry) => entry.id === "kire")).toMatchObject({
      displayTerm: "きれ",
      parentTermId: "atoaji",
      sourceCategory: "aftertaste",
    });
    expect(context.every((entry) => !("provenance" in entry))).toBe(true);
  });

  it("excludes reference-only terms from serialized, allowed, and validated candidates", () => {
    const allowed = getSelectableSensoryTermIds();
    expect(allowed).toEqual(["atoaji", "kire", "nameraka", "marui"]);
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
  });

  it("keeps observable input separate from legacy reductive dimensions", () => {
    const input = buildSensoryBridgeInput(features);
    expect(input).toMatchObject({ direction: "lateral", repetition: "repeated", spread: "broad" });
    expect(input).not.toHaveProperty("weight");
    expect(JSON.stringify(input)).not.toContain("shape");
    const instruction = buildSensoryBridgeInstruction({
      modality: "body",
      input,
      allowedTermIds: getSelectableSensoryTermIds(),
    });
    expect(instruction).toContain("kire");
    expect(instruction).not.toContain("nojun");
    expect(instruction).not.toContain("weight:heavy");
    expect(instruction).not.toContain("shape:sharp");
  });

  it("keeps broad repeated lateral sway unmapped in the deterministic fixture", async () => {
    const response = await createFixtureSensoryBridgeProvider().interpret({
      modality: "body",
      input: buildSensoryBridgeInput(features),
      allowedTermIds: getSelectableSensoryTermIds(),
    });
    const validated = validateSensoryBridgeResponse(response);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.value.candidateTermIds).toEqual([]);
  });

  it("serializes only derived input and validates selectable candidates", () => {
    const request = {
      modality: "body" as const,
      input: buildSensoryBridgeInput(features),
      allowedTermIds: getSelectableSensoryTermIds(),
    };
    expect(serializeSensoryBridgeRequest(request)).not.toContain("definitionSummary");
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: [],
        candidateTermIds: ["kire"],
        unmappedFeatures: [],
        reason: "実験的な候補です",
      }).ok,
    ).toBe(true);
  });

  it("rejects malformed, unknown, duplicate, and extra bridge response data", () => {
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
  });

  it("accepts zero candidates as an intentional unmapped result", () => {
    expect(
      validateSensoryBridgeResponse({
        sensoryExpressions: ["まだ言葉にしにくい感じ"],
        candidateTermIds: [],
        unmappedFeatures: ["direction:lateral"],
        reason: "候補を絞れません",
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
  });
});
