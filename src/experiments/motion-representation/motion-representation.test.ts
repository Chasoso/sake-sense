import { describe, expect, it } from "vitest";
import { extractBodyMovementFeatures } from "../../domain/body";
import { motionFixtures } from "./fixtures";
import { compareMotionRepresentations, summarizeCollisionCounts } from "./report";
import { describeMotion, segmentMotionPhases } from "./descriptors";
import { createMotionSignature } from "./signature";
import type { BodyLandmark, BodyPoseFrame } from "../../domain/body";

function translate(frames: BodyPoseFrame[], x: number, scale = 1): BodyPoseFrame[] {
  return frames.map((frame) => ({
    ...frame,
    landmarks: frame.landmarks.map((landmark) => ({
      ...landmark,
      x: x + landmark.x * scale,
      y: landmark.y * scale,
    })),
  }));
}

function jitter(frames: BodyPoseFrame[]): BodyPoseFrame[] {
  return frames.map((frame, frameIndex) => ({
    ...frame,
    landmarks: frame.landmarks.map((landmark, landmarkIndex) => ({
      ...landmark,
      x: landmark.x + Math.sin(frameIndex + landmarkIndex) * 0.001,
      y: landmark.y + Math.cos(frameIndex + landmarkIndex) * 0.001,
    })),
  }));
}

function blankFrame(t: number, points: Record<number, { x: number; y: number }>): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  landmarks[11] = { x: -0.5, y: 0 };
  landmarks[12] = { x: 0.5, y: 0 };
  landmarks[23] = { x: -0.3, y: 1 };
  landmarks[24] = { x: 0.3, y: 1 };
  Object.entries(points).forEach(([index, point]) => {
    landmarks[Number(index)] = point;
  });
  return { t, landmarks };
}

describe("motion representation experiment", () => {
  it("provides the requested deterministic gesture fixture set", () => {
    expect(motionFixtures).toHaveLength(12);
    expect(new Set(motionFixtures.map((fixture) => fixture.id)).size).toBe(12);
  });

  it("normalizes translation and body scale around the shoulder frame", () => {
    const source = motionFixtures[0].frames;
    const original = createMotionSignature(source);
    const shifted = createMotionSignature(translate(source, 7, 1.8));
    expect(shifted.trajectory.pathShape).toBe(original.trajectory.pathShape);
    expect(shifted.trajectory.dominantDirection).toBe(original.trajectory.dominantDirection);
    expect(shifted.rhythm.repetitionCount).toBe(original.rhythm.repetitionCount);
  });

  it("keeps small sensor jitter close to the original representation", () => {
    const source = motionFixtures[4].frames;
    const original = createMotionSignature(source);
    const noisy = createMotionSignature(jitter(source));
    expect(noisy.trajectory.pathShape).toBe(original.trajectory.pathShape);
    expect(
      Math.abs(noisy.trajectory.spatialExtent - original.trajectory.spatialExtent),
    ).toBeLessThan(0.03);
    expect(Math.abs(noisy.dynamics.meanSpeed - original.dynamics.meanSpeed)).toBeLessThan(0.001);
  });

  it("describes direction, dynamics, ending, and body contribution", () => {
    const descriptors = describeMotion(motionFixtures[10].frames);
    expect(descriptors.trajectory.dominantDirection).toBe("right");
    expect(descriptors.dynamics.accelerationTendency).toBe("decelerating");
    expect(descriptors.bodyUsage.dominantJoints).toContain("leftWrist");
    expect(descriptors.ending.shape).toBe("gradual");
  });

  it("detects a pause and preserves temporal phases", () => {
    const pause = motionFixtures[9].frames;
    const descriptors = describeMotion(pause);
    const phases = segmentMotionPhases(pause, descriptors);
    expect(descriptors.rhythm.pauseCount).toBeGreaterThanOrEqual(1);
    expect(phases.length).toBeGreaterThanOrEqual(2);
    expect(phases.some((phase) => phase.label === "pause")).toBe(true);
  });

  it("captures symmetry and asymmetry without sending raw landmarks", () => {
    const asymmetric = describeMotion(motionFixtures[11].frames);
    const symmetricFrames = Array.from({ length: 5 }, (_, index) =>
      blankFrame(index * 500, {
        15: { x: -0.4 + index * 0.1, y: -0.5 },
        16: { x: 0.4 - index * 0.1, y: -0.5 },
      }),
    );
    const symmetric = describeMotion(symmetricFrames);
    expect(asymmetric.bodyUsage.leftRightAsymmetry).toBeGreaterThan(0.5);
    expect(symmetric.bodyUsage.symmetry).toBeGreaterThan(0.9);
    expect(JSON.stringify(createMotionSignature(motionFixtures[0].frames))).not.toContain(
      "landmarks",
    );
  });

  it("compares the current coarse baseline with the richer signature", () => {
    const comparisons = compareMotionRepresentations();
    const summary = summarizeCollisionCounts(comparisons);
    expect(summary.gestureCount).toBe(12);
    expect(summary.baselineUnique).toBeGreaterThan(0);
    expect(summary.signatureUnique).toBeGreaterThanOrEqual(summary.baselineUnique);
    expect(summary.recoveredDistinctions).toBeGreaterThanOrEqual(0);
    expect(comparisons[0].current).toEqual(extractBodyMovementFeatures(motionFixtures[0].frames));
  });
});
