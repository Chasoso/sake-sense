import { describe, expect, it } from "vitest";
import { extractBodyMovementFeatures } from "../../domain/body";
import { endingFixtures, motionFixtures, pathShapeFixtures } from "./fixtures";
import { compareMotionRepresentations, signatureKey, summarizeCollisionCounts } from "./report";
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
      x: landmark.x + Math.sin(frameIndex + landmarkIndex) * 0.0001,
      y: landmark.y + Math.cos(frameIndex + landmarkIndex) * 0.0001,
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

  it("does not create a new quantized identity from small noise", () => {
    const source = motionFixtures[4].frames;
    const noisy = jitter(source);
    expect(signatureKey(createMotionSignature(source))).toBe(
      signatureKey(createMotionSignature(noisy)),
    );
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
    expect(summary.fixtureCount).toBe(12);
    expect(summary.coarseUnique).toBeGreaterThan(0);
    expect(summary.fullCurrentUnique).toBeGreaterThan(0);
    expect(summary.motionSignatureUnique).toBeGreaterThan(0);
    expect(summary.recoveredObservableDistinctions).toBeGreaterThanOrEqual(0);
    expect(comparisons[0].current).toEqual(extractBodyMovementFeatures(motionFixtures[0].frames));
  });

  it("distinguishes straight, out-and-back, curved, circular, and oscillating paths", () => {
    const shapes = new Map(
      pathShapeFixtures.map((fixture) => [
        fixture.id,
        describeMotion(fixture.frames).trajectory.pathShape,
      ]),
    );
    expect(shapes.get("straight-one-way")).toBe("straight");
    expect(shapes.get("straight-out-and-back")).toBe("out-and-back");
    expect(shapes.get("ellipse")).toBe("circular");
    expect(shapes.get("curved-arc")).toBe("curved");
    expect(shapes.get("lateral-oscillation")).toBe("oscillating");
    expect(shapes.get("straight-out-and-back")).not.toBe("circular");
  });

  it("consolidates a pause and preserves the active phase after it", () => {
    const phases = segmentMotionPhases(motionFixtures[9].frames);
    expect(phases.map((phase) => phase.label)).toEqual(["active", "pause", "active"]);
  });

  it("separates gradual, abrupt, and continued endings", () => {
    const endings = endingFixtures.map((fixture) => describeMotion(fixture.frames).ending.shape);
    expect(endings).toEqual(["gradual", "abrupt", "sustained"]);
  });

  it("does not invent a distinction for fingertip movement absent from Pose", () => {
    const fingertip = createMotionSignature(motionFixtures[2].frames);
    const still = createMotionSignature(motionFixtures[2].frames.map((frame) => ({ ...frame })));
    expect(fingertip).toEqual(still);
  });
});
