import { describe, expect, it } from "vitest";
import {
  runBodySemanticExperiment,
  runLocalExperiment,
  runVoiceSemanticExperiment,
} from "./experiment";
import type { BodyMovementFeatures } from "./body";
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

describe("experiment integration boundaries", () => {
  it("keeps the existing text mapping as a legacy compatibility path", () => {
    const result = runLocalExperiment("スッ", stroke);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.map((candidate) => candidate.entry.id)).toEqual(["kire"]);
    expect(result.sakeProducts.every((match) => match.matchedTermIds.includes("kire"))).toBe(true);
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
});
