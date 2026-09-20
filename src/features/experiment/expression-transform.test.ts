import { describe, expect, it } from "vitest";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";
import {
  getBodyDisplayWords,
  getBodyIntermediateWords,
  getBodyTrailGeometry,
  getBodyTransformProgress,
  getBodyVisualModel,
  getTransformProgress,
  getTransformStage,
  getVoiceIntermediateWords,
  windowProgress,
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

  it("uses a continuous bounded progress value and holds for slow responses", () => {
    expect(getTransformProgress(0)).toBe(0);
    expect(getTransformProgress(2600)).toBeCloseTo(0.5);
    expect(getTransformProgress(5200)).toBe(1);
    expect(getTransformProgress(12000)).toBe(1);
  });

  it("reaches the calm Body waiting composition within a typical short response", () => {
    expect(getBodyTransformProgress(0)).toBe(0);
    expect(getBodyTransformProgress(1000)).toBeCloseTo(0.5);
    expect(getBodyTransformProgress(1600)).toBeCloseTo(0.8);
    expect(getBodyTransformProgress(2000)).toBe(1);
    expect(getBodyTransformProgress(6000)).toBe(1);
  });

  it("derives stable body words from observable body features", () => {
    const words = getBodyIntermediateWords(bodyFeatures);
    expect(words).toEqual(["横へ", "くり返す", "広がる", "ゆっくり消える"]);
    expect(words.join(" ")).not.toMatch(/あと味|切れ|淡麗|濃醇|kire|atoaji/);
  });

  it("limits Body screen words to two deterministic local observations", () => {
    const words = getBodyDisplayWords(bodyFeatures);
    expect(words).toHaveLength(2);
    expect(words).toEqual(getBodyDisplayWords(bodyFeatures));
    expect(words.join(" ")).not.toMatch(/kire|atoaji|濃醇|淡麗/);
  });

  it("changes the body abstract model for direction, repetition, expansion, and ending", () => {
    const lateral = getBodyVisualModel(bodyFeatures);
    const upward = getBodyVisualModel({
      ...bodyFeatures,
      endingBehavior: "abrupt",
      motionShape: {
        ...bodyFeatures.motionShape,
        dominantDirection: "upward",
        repetition: "single",
        expansion: "contracting",
      },
    });
    expect(lateral.trailSpread).toBeGreaterThan(upward.trailSpread);
    expect(lateral.echoStrength).toBeGreaterThan(upward.echoStrength);
    expect(lateral.softOffset).not.toEqual(upward.softOffset);
    expect(upward.direction).toBe("upward");
    expect(upward.expansion).toBe("contracting");
    expect(upward.ending).toBe("abrupt");
  });

  it("keeps layer progress bounded and smooth across its windows", () => {
    expect(windowProgress(-1, 0, 1)).toBe(0);
    expect(windowProgress(0.5, 0, 1)).toBeCloseTo(0.5);
    expect(windowProgress(2, 0, 1)).toBe(1);
    expect(windowProgress(0.1, 0.2, 0.8)).toBe(0);
    expect(windowProgress(0.9, 0.2, 0.8)).toBe(1);
  });

  it("derives deterministic smooth trails and excludes low-visibility points", () => {
    const frame = (leftVisibility: number, rightVisibility: number): BodyPoseFrame => ({
      t: 0,
      landmarks: Array.from({ length: 17 }, (_, index) => ({
        x: index === 15 ? 0.2 : index === 16 ? 0.8 : index === 11 ? 0.4 : index === 12 ? 0.6 : 0.5,
        y: index === 15 || index === 16 ? 0.7 : index === 11 || index === 12 ? 0.3 : 0.5,
        visibility: index === 15 ? leftVisibility : index === 16 ? rightVisibility : 1,
      })),
    });
    const frames = [
      frame(0.2, 0.9),
      {
        ...frame(0.2, 0.9),
        t: 100,
        landmarks: frame(0.2, 0.9).landmarks.map((point, index) => ({
          ...point,
          x: index === 16 ? 0.7 : point.x,
        })),
      },
      {
        ...frame(0.2, 0.9),
        t: 200,
        landmarks: frame(0.2, 0.9).landmarks.map((point, index) => ({
          ...point,
          x: index === 16 ? 0.65 : point.x,
        })),
      },
    ];
    const first = getBodyTrailGeometry(frames);
    expect(first).toEqual(getBodyTrailGeometry(frames));
    expect(first.leftWristPath).toBe("M 160 80");
    expect(first.rightWristPath).toContain("Q");
    expect(first.primarySource).toBe("rightWrist");
    expect(first.primaryPath).not.toContain("64.0 112.0");
  });

  it("derives stable voice words from local voice features", () => {
    expect(getVoiceIntermediateWords(voiceFeatures)).toEqual([
      "大きく",
      "長く",
      "間をあけて",
      "ゆっくり消える",
    ]);
  });

  it("keeps both wrist traces for opposite-hand movement", () => {
    const frames = [0, 1, 2].map((step) => ({
      t: step * 100,
      landmarks: Array.from({ length: 17 }, (_, index) => ({
        x:
          index === 15
            ? 0.25 + step * 0.08
            : index === 16
              ? 0.75 - step * 0.08
              : index === 11
                ? 0.4
                : index === 12
                  ? 0.6
                  : 0.5,
        y: index === 15 || index === 16 ? 0.7 : index === 11 || index === 12 ? 0.3 : 0.5,
        visibility: 1,
      })),
    }));
    const geometry = getBodyTrailGeometry(frames);
    expect(geometry.leftWristPathLength).toBeGreaterThan(2);
    expect(geometry.rightWristPathLength).toBeGreaterThan(2);
    expect(geometry.leftWristPath).toContain("Q");
    expect(geometry.rightWristPath).toContain("Q");
  });
});
