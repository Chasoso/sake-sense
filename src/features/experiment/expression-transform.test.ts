import { describe, expect, it } from "vitest";
import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";
import {
  getBodyDisplayWords,
  getBodyDissolveOpacity,
  getBodyAbsorbedPoint,
  getBodyIntermediateWords,
  getBodyLightProgress,
  getBodyProcessingDots,
  getBodySkeletonGeometry,
  getBodyTransformProgress,
  getBodyVisualModel,
  getTransformProgress,
  getTransformStage,
  getVoiceIntermediateWords,
  selectSkeletonFrameIndex,
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

function selectionFrame(visibility: Partial<Record<number, number>>): BodyPoseFrame {
  return {
    t: 0,
    landmarks: Array.from({ length: 17 }, (_, index) => ({
      x: 0.5,
      y: 0.5,
      visibility: visibility[index] ?? 0.1,
    })),
  };
}

describe("expression transformation", () => {
  it("progresses through local transformation stages without fake progress", () => {
    expect(getTransformStage(0)).toBe(0);
    expect(getTransformStage(1500)).toBe(1);
    expect(getTransformStage(3000)).toBe(2);
    expect(getTransformStage(4500)).toBe(3);
  });

  it("cycles Body processing dots every 500ms", () => {
    expect(getBodyProcessingDots(0)).toBe(".");
    expect(getBodyProcessingDots(499)).toBe(".");
    expect(getBodyProcessingDots(500)).toBe("..");
    expect(getBodyProcessingDots(1000)).toBe("...");
    expect(getBodyProcessingDots(1500)).toBe(".");
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

  it("uses overlapping monotonic dissolve and light progress for Body waiting", () => {
    const samples = [0, 0.2, 0.5, 0.8, 1].map((progress) => ({
      light: getBodyLightProgress(progress),
      opacity: getBodyDissolveOpacity(progress),
    }));
    expect(samples[0]).toEqual({ light: 0, opacity: 1 });
    expect(samples.at(-1)?.light).toBe(1);
    expect(samples.at(-1)?.opacity).toBe(0);
    expect(
      samples.every((sample, index) => index === 0 || sample.light >= samples[index - 1].light),
    ).toBe(true);
    expect(
      samples.every((sample, index) => index === 0 || sample.opacity <= samples[index - 1].opacity),
    ).toBe(true);
    expect(samples[2].light).toBeGreaterThan(0);
    expect(samples[2].opacity).toBeGreaterThan(0);
  });

  it("pulls each Body point into the center with a restrained radial swirl", () => {
    const outerPoint = { x: 40, y: 80 };
    const innerPoint = { x: 145, y: 80 };
    expect(getBodyAbsorbedPoint(outerPoint, 0).x).toBeCloseTo(outerPoint.x);
    expect(getBodyAbsorbedPoint(outerPoint, 0).y).toBeCloseTo(outerPoint.y);
    expect(getBodyAbsorbedPoint(outerPoint, 1).x).toBeGreaterThan(outerPoint.x);
    expect(getBodyAbsorbedPoint(outerPoint, 1).x).toBeLessThan(160);
    expect(getBodyAbsorbedPoint(outerPoint, 1).y).not.toBe(80);
    expect(getBodyAbsorbedPoint(innerPoint, 1).x).toBeGreaterThan(innerPoint.x);
  });

  it("selects a visible upper-body frame near the center", () => {
    const good = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 };
    const oneWrist = { ...good, 16: 0.1 };
    const frames = [
      selectionFrame(good),
      selectionFrame(oneWrist),
      selectionFrame({ 11: 1, 12: 1 }),
      selectionFrame(good),
      selectionFrame(good),
    ];
    expect(selectSkeletonFrameIndex(frames)).toBe(3);
  });

  it("prioritizes both visible wrists over a single visible wrist", () => {
    const oneWrist = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
    const bothWrists = { ...oneWrist, 16: 1 };
    const frames = [
      selectionFrame(oneWrist),
      selectionFrame(oneWrist),
      selectionFrame(bothWrists),
      selectionFrame(oneWrist),
      selectionFrame(oneWrist),
    ];
    expect(selectSkeletonFrameIndex(frames)).toBe(2);
  });

  it("uses center proximity to break visibility score ties", () => {
    const good = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 };
    const frames = [
      selectionFrame({}),
      selectionFrame({}),
      selectionFrame(good),
      selectionFrame(good),
      selectionFrame({}),
      selectionFrame({}),
    ];
    expect(selectSkeletonFrameIndex(frames)).toBe(2);
  });

  it("falls back to the full capture when the middle window has no skeleton", () => {
    const good = { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 };
    const frames = [
      selectionFrame(good),
      selectionFrame({}),
      selectionFrame({}),
      selectionFrame({}),
      selectionFrame(good),
    ];
    expect(selectSkeletonFrameIndex(frames)).toBe(0);
  });

  it("keeps a deterministic fallback for globally poor visibility", () => {
    const frames = Array.from({ length: 5 }, () => selectionFrame({}));
    expect(selectSkeletonFrameIndex(frames)).toBe(2);
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

  it("derives a deterministic stable skeleton and excludes low-visibility points", () => {
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
    const first = getBodySkeletonGeometry(frames);
    expect(first).toEqual(getBodySkeletonGeometry(frames));
    expect(first.skeletonFrameIndex).toBe(1);
    expect(first.skeletonPoints).toHaveLength(5);
    expect(first.skeletonPath).toContain("L");
  });

  it("derives stable voice words from local voice features", () => {
    expect(getVoiceIntermediateWords(voiceFeatures)).toEqual([
      "大きく",
      "長く",
      "間をあけて",
      "ゆっくり消える",
    ]);
  });

  it("keeps the skeleton stable when both wrists are visible", () => {
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
    const geometry = getBodySkeletonGeometry(frames);
    expect(geometry.skeletonPath).toContain("L");
    expect(geometry.skeletonPoints.length).toBeGreaterThan(0);
  });

  it("keeps skeleton selection deterministic across visibility gaps", () => {
    const frame = (visibility: number, step: number): BodyPoseFrame => ({
      t: step * 100,
      landmarks: Array.from({ length: 17 }, (_, index) => ({
        x:
          index === 15
            ? 0.2 + step * 0.03
            : index === 16
              ? 0.8 - step * 0.03
              : index === 11
                ? 0.4
                : index === 12
                  ? 0.6
                  : 0.5,
        y: index === 15 || index === 16 ? 0.7 : index === 11 || index === 12 ? 0.3 : 0.5,
        visibility: index === 15 || index === 16 ? visibility : 1,
      })),
    });
    const frames = [
      frame(1, 0),
      frame(1, 1),
      frame(1, 2),
      frame(1, 3),
      frame(1, 4),
      frame(1, 5),
      frame(1, 6),
      frame(1, 7),
      frame(0.1, 8),
      frame(0.1, 9),
      frame(1, 10),
      frame(1, 11),
    ];
    const geometry = getBodySkeletonGeometry(frames);
    expect(selectSkeletonFrameIndex(frames)).toBe(5);
    expect(geometry.skeletonFrameIndex).toBe(5);
    expect(geometry.skeletonPoints.length).toBeGreaterThan(0);
  });
});
