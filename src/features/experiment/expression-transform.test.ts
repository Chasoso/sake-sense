import { describe, expect, it } from "vitest";
import type { BodyMovementFeatures } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";
import {
  getBodyIntermediateWords,
  getTransformStage,
  getVoiceIntermediateWords,
} from "./expression-transform";

const bodyFeatures: BodyMovementFeatures = {
  frameCount: 20,
  captureDurationMs: 3000,
  activeDurationMs: 2400,
  totalMovement: 2,
  averageSpeed: 0.2,
  peakSpeed: 0.4,
  hasSustainedFastMovement: true,
  spread: 0.4,
  hasMeaningfulMovement: true,
  activeJointCount: 3,
  endingSpeedRatio: 0.2,
  endingBehavior: "gradual",
  motionShape: {
    expansion: "expanding",
    dominantDirection: "lateral",
    repetition: "repeated",
    participation: "localized",
  },
};

const voiceFeatures: VoiceFeatures = {
  durationMs: 1800,
  averageIntensity: 0.5,
  pauseCount: 1,
  endingBehavior: "fading",
};

describe("expression transformation", () => {
  it("progresses through local transformation stages without fake progress", () => {
    expect(getTransformStage(0)).toBe(0);
    expect(getTransformStage(1500)).toBe(1);
    expect(getTransformStage(3000)).toBe(2);
    expect(getTransformStage(4500)).toBe(3);
  });

  it("derives stable body words from observable body features", () => {
    const words = getBodyIntermediateWords(bodyFeatures);
    expect(words).toEqual(["横へ", "くり返す", "広がる", "ゆっくり消える"]);
    expect(words.join(" ")).not.toMatch(/あと味|切れ|淡麗|濃醇|kire|atoaji/);
  });

  it("derives stable voice words from local voice features", () => {
    expect(getVoiceIntermediateWords(voiceFeatures)).toEqual([
      "大きく",
      "長く",
      "間をあけて",
      "ゆっくり消える",
    ]);
  });
});
