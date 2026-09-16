import { describe, expect, it } from "vitest";
import { runBodySemanticExperiment, runLocalExperiment } from "./experiment";
import type { BodyMovementFeatures } from "./body";

const stroke = [
  { x: 10, y: 40, t: 0 },
  { x: 160, y: 40, t: 120 },
];
const broadRepeatedSway: BodyMovementFeatures = {
  frameCount: 12,
  captureDurationMs: 3000,
  activeDurationMs: 2200,
  totalMovement: 3,
  averageSpeed: 0.0025,
  peakSpeed: 0.004,
  spread: 3,
  hasMeaningfulMovement: true,
  activeJointCount: 4,
  endingSpeedRatio: 0.9,
  endingBehavior: "continued",
  hasSustainedFastMovement: false,
  motionShape: {
    expansion: "unknown",
    dominantDirection: "lateral",
    repetition: "repeated",
    participation: "broad",
  },
};

describe("local experiment vocabulary boundary", () => {
  it("allows a reviewed everyday expression to select a reviewed term", () => {
    const result = runLocalExperiment("スッ", stroke);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.map((candidate) => candidate.entry.id)).toEqual(["kire"]);
  });

  it("does not turn a gesture or voice representation into deterministic sake terms", () => {
    const result = runLocalExperiment("未知", stroke, {
      durationMs: 400,
      averageIntensity: 0.4,
      pauseCount: 0,
      endingBehavior: "maintained",
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates).toEqual([]);
    expect(result.interpretation).toBe("no-match");
  });

  it("keeps broad lateral movement unmapped rather than returning nojun", async () => {
    const result = await runBodySemanticExperiment(broadRepeatedSway);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sensoryBridge?.response.candidateTermIds).toEqual([]);
    expect(result.candidates.map((candidate) => candidate.entry.id)).not.toContain("nojun");
  });

  it("does not revive the old round or concentration expression shortcuts", () => {
    for (const expression of ["ふわ", "こく"]) {
      const result = runLocalExperiment(expression, stroke);
      expect("error" in result).toBe(false);
      if ("error" in result) continue;
      expect(result.candidates).toEqual([]);
    }
  });
});
