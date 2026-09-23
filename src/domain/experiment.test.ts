import { describe, expect, it } from "vitest";
import {
  runBodySemanticExperiment,
  runGestureSemanticExperiment,
  runLocalExperiment,
  runVoiceSemanticExperiment,
} from "./experiment";
import type { BodyMovementFeatures } from "./body";
import type { GestureFeatures } from "./gesture";
import type { VoiceFeatures } from "./voice";

const stroke = [
  { x: 10, y: 40, t: 0 },
  { x: 80, y: 40, t: 100 },
  { x: 160, y: 40, t: 120 },
];
const bodyFeatures: BodyMovementFeatures = {
  frameCount: 12,
  captureDurationMs: 3000,
  activeDurationMs: 1200,
  totalMovement: 3,
  averageSpeed: 0.0025,
  peakSpeed: 0.004,
  spread: 3,
  hasMeaningfulMovement: true,
  activeJointCount: 4,
  endingSpeedRatio: 0.9,
  endingBehavior: "abrupt",
  hasSustainedFastMovement: false,
  motionShape: {
    expansion: "expanding",
    dominantDirection: "unknown",
    repetition: "single",
    participation: "broad",
  },
};
const voiceFeatures: VoiceFeatures = {
  durationMs: 1200,
  averageIntensity: 0.4,
  pauseCount: 1,
  endingBehavior: "fading",
};
const gestureFeatures: GestureFeatures = {
  pointCount: 12,
  durationMs: 1200,
  pathLength: 18.25,
  averageSpeed: 0.015,
  spread: 4.5,
  horizontalDirectionChanges: 2,
  endingSpeedRatio: 0.4,
  abruptEnding: false,
};

describe("experiment integration boundaries", () => {
  it("keeps the existing text mapping as a legacy compatibility path", () => {
    const result = runLocalExperiment("スッ", stroke);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.map((candidate) => candidate.entry.id)).toEqual(["kire"]);
    expect(result.sakeProducts.every((match) => match.matchedTermIds.includes("kire"))).toBe(true);
  });

  it("keeps the local Gesture result path independent from Voice input", () => {
    const result = runLocalExperiment("gesture", stroke);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.voiceFeatures).toBeNull();
    expect(result.bodyFeatures).toBeNull();
    expect(result.gesture.pointCount).toBe(3);
    expect(result.inputSource).toBe("text");
  });

  it("does not make gesture or voice observations direct term candidates", () => {
    const result = runLocalExperiment("未知", stroke, voiceFeatures, bodyFeatures);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates).toEqual([]);
    expect(result.sakeProducts).toEqual([]);
    expect(result.interpretation).toBe("no-match");
  });

  it("uses approved support links but keeps candidate links termless", async () => {
    for (const [features, candidateTermIds] of [
      [
        {
          ...bodyFeatures,
          activeDurationMs: 500,
          endingBehavior: "abrupt" as const,
          motionShape: { ...bodyFeatures.motionShape, expansion: "unknown" as const },
        },
        ["kire"],
      ],
      [
        {
          ...bodyFeatures,
          activeDurationMs: 2400,
          endingBehavior: "gradual" as const,
          motionShape: { ...bodyFeatures.motionShape, expansion: "unknown" as const },
        },
        [],
      ],
    ] as const) {
      const result = await runBodySemanticExperiment(features);
      expect("error" in result).toBe(false);
      if ("error" in result) continue;
      expect(result.sensoryBridge?.provider).toBe("fixture");
      expect(result.sensoryBridge?.response.candidateTermIds).toEqual(candidateTermIds);
      if (!candidateTermIds.length) expect(result.sakeProducts).toEqual([]);
    }
  });

  it("keeps broad repeated lateral movement unmapped rather than returning nojun", async () => {
    const result = await runBodySemanticExperiment({
      ...bodyFeatures,
      activeDurationMs: 2200,
      endingBehavior: "continued",
      motionShape: {
        expansion: "unknown",
        dominantDirection: "lateral",
        repetition: "repeated",
        participation: "broad",
      },
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sensoryBridge?.response.candidateTermIds).toEqual([]);
    expect(result.sakeProducts).toEqual([]);
  });

  it("keeps provider failure and invalid AI output observation-only", async () => {
    const failing = await runBodySemanticExperiment(bodyFeatures, {
      kind: "ai",
      interpret: async () => {
        throw new Error("provider unavailable");
      },
    });
    const invalid = await runBodySemanticExperiment(bodyFeatures, {
      kind: "ai",
      interpret: async () => ({
        sensoryExpressions: [],
        candidateTermIds: ["invented-term"],
        unmappedFeatures: [],
        reason: "候補です",
      }),
    });
    for (const result of [failing, invalid]) {
      expect("error" in result).toBe(false);
      if ("error" in result) continue;
      expect(result.sensoryBridge?.provider).toBe("fallback");
      expect(result.candidates).toEqual([]);
      expect(result.sakeProducts).toEqual([]);
    }
  });

  it("passes only derived voice fields through the AI boundary and falls back safely", async () => {
    const base = runLocalExperiment("", [], voiceFeatures);
    expect("error" in base).toBe(false);
    if ("error" in base) return;
    let received: unknown;
    const result = await runVoiceSemanticExperiment(base, voiceFeatures, {
      kind: "ai",
      interpret: async (request) => {
        received = request;
        return {
          sensoryExpressions: ["余韻が残る感じ"],
          candidateTermIds: [],
          unmappedFeatures: [],
          reason: "derived voice observations",
        };
      },
    });
    expect(result.sensoryBridge?.modality).toBe("voice");
    expect(result.sensoryBridge?.provider).toBe("ai");
    expect(result.candidates).toEqual([]);
    expect(result.sakeProducts).toEqual([]);
    expect(JSON.stringify(received)).not.toContain("audio");
    expect(JSON.stringify(received)).not.toContain("samples");
    expect(JSON.stringify(received)).not.toContain("displayTerm");

    const fallback = await runVoiceSemanticExperiment(base, voiceFeatures, {
      kind: "ai",
      interpret: async () => {
        throw new Error("provider unavailable");
      },
    });
    expect(fallback.sensoryBridge?.provider).toBe("fallback");
    expect(fallback.candidates).toEqual([]);
  });

  it("passes only semantically grounded AI candidates to product matching", async () => {
    const mapped = await runBodySemanticExperiment(
      {
        ...bodyFeatures,
        activeDurationMs: 500,
        motionShape: { ...bodyFeatures.motionShape, expansion: "unknown" },
      },
      {
        kind: "ai",
        interpret: async () => ({
          sensoryExpressions: [],
          candidateTermIds: ["atoaji"],
          unmappedFeatures: [],
          reason: "provider candidate",
        }),
      },
    );
    expect("error" in mapped).toBe(false);
    if ("error" in mapped) return;
    expect(mapped.candidates.map((candidate) => candidate.entry.id)).toEqual(["kire"]);
    expect(mapped.sakeProducts.every((match) => match.matchedTermIds.includes("kire"))).toBe(true);

    const unsupported = await runBodySemanticExperiment(bodyFeatures, {
      kind: "ai",
      interpret: async () => ({
        sensoryExpressions: [],
        candidateTermIds: ["atoaji"],
        unmappedFeatures: [],
        reason: "provider candidate",
      }),
    });
    expect("error" in unsupported).toBe(false);
    if ("error" in unsupported) return;
    expect(unsupported.sensoryBridge?.response.candidateTermIds).toEqual([]);
    expect(unsupported.sakeProducts).toEqual([]);
  });

  it("sends only deterministic GestureFeatures to the Gesture Sensory Bridge", async () => {
    let received: unknown;
    const result = await runGestureSemanticExperiment(gestureFeatures, {
      kind: "ai",
      interpret: async (request) => {
        received = request;
        return {
          sensoryInterpretation: {
            outcome: "interpreted",
            sensoryExpression: "繧峨↑繧√ｉ縺九↑蜍輔″",
            semanticProfile: {
              timeQuality: "sustained",
              weightQuality: "unknown",
              flowQuality: "free",
              directness: "direct",
              persistence: "moderate",
              resolution: "gradual",
              continuity: "continuous",
              rhythmicity: "singular",
              expansion: "neutral",
              spread: "neutral",
              smoothness: "smooth",
              roundness: "unknown",
            },
          },
          sensoryClassProposals: ["smooth-flow"],
          sensoryExpressions: ["繧峨↑繧√ｉ縺九↑蜍輔″"],
          candidateTermIds: ["nameraka"],
          unmappedFeatures: [],
          reason: "隕ｳ貂ｬ縺励◆蜍輔″縺ｮ迚ｹ蠕ｴ",
          authorization: [
            { termId: "nameraka", sensoryClass: "smooth-flow", level: "strong", supportCount: 2 },
          ],
          authorizationConflicts: [],
        };
      },
    });

    expect(received).toEqual({
      modality: "gesture",
      input: {
        durationMs: 1200,
        pointCount: 12,
        pathLength: 18.25,
        averageSpeed: 0.015,
        spread: 4.5,
        horizontalDirectionChanges: 2,
        endingSpeedRatio: 0.4,
        abruptEnding: false,
      },
      allowedTermIds: expect.arrayContaining(["nameraka"]),
    });
    expect(JSON.stringify(received)).not.toContain('"x"');
    expect(JSON.stringify(received)).not.toContain('"y"');
    expect(JSON.stringify(received)).not.toContain('"t"');
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.inputSource).toBe("gesture");
    expect(result.sensoryBridge).toMatchObject({ modality: "gesture", provider: "ai" });
    expect(result.candidates.map((candidate) => candidate.entry.id)).toEqual(["nameraka"]);
    expect(result.sakeProducts.length).toBeGreaterThan(0);
    expect(result.sakeProducts.every((match) => match.matchedTermIds.includes("nameraka"))).toBe(
      true,
    );
  });

  it("uses the Gesture fixture path and fails safely for malformed or unavailable providers", async () => {
    const fixture = await runGestureSemanticExperiment(gestureFeatures);
    expect("error" in fixture).toBe(false);
    if ("error" in fixture) return;
    expect(fixture.inputSource).toBe("gesture");
    expect(fixture.sensoryBridge?.modality).toBe("gesture");
    expect(fixture.sensoryBridge?.provider).toBe("fixture");
    expect(fixture.candidates.map((candidate) => candidate.entry.id)).toEqual(["nameraka"]);

    const malformed = await runGestureSemanticExperiment(gestureFeatures, {
      kind: "ai",
      interpret: async () => ({
        sensoryExpressions: [],
        candidateTermIds: ["not-reviewed"],
        unmappedFeatures: [],
        reason: "蛟呵｣懊〒縺・",
      }),
    });
    const failed = await runGestureSemanticExperiment(gestureFeatures, {
      kind: "ai",
      interpret: async () => {
        throw new Error("provider unavailable");
      },
    });
    for (const result of [malformed, failed]) {
      expect("error" in result).toBe(false);
      if ("error" in result) continue;
      expect(result.inputSource).toBe("gesture");
      expect(result.sensoryBridge?.provider).toBe("fallback");
      expect(result.candidates).toEqual([]);
      expect(result.sakeProducts).toEqual([]);
    }
  });
});
