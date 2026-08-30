import { describe, expect, it } from "vitest";
import {
  bodyToRepresentation,
  extractBodyMovementFeatures,
  humanizeBodyFeatures,
  type BodyLandmark,
  type BodyPoseFrame,
} from "./body";

function frame(t: number, wristX: number): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  landmarks[11] = { x: -0.5, y: 0 };
  landmarks[12] = { x: 0.5, y: 0 };
  landmarks[15] = { x: wristX, y: -0.5 };
  return { t, landmarks };
}

describe("body movement features", () => {
  it("extracts a short movement and maps it to short duration", () => {
    const features = extractBodyMovementFeatures([frame(0, 0), frame(500, 0.4)]);

    expect(features.captureDurationMs).toBe(500);
    expect(features.activeDurationMs).toBe(500);
    expect(features.totalMovement).toBeGreaterThan(0);
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
    );
  });

  it("extracts a sustained movement and maps it to lingering duration", () => {
    const features = extractBodyMovementFeatures([frame(0, 0), frame(1500, 0.4), frame(3000, 0.8)]);

    expect(features.captureDurationMs).toBe(3000);
    expect(features.activeDurationMs).toBe(3000);
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "lingering" }),
    );
  });

  it("uses active movement duration instead of the full capture window", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(200, 0),
      frame(700, 1),
      frame(3000, 1),
    ]);

    expect(features.captureDurationMs).toBe(3000);
    expect(features.activeDurationMs).toBe(500);
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
    );
  });

  it("evaluates an abrupt ending before a long inactive tail", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(200, 0),
      frame(400, 0.5),
      frame(600, 1),
      frame(700, 1.5),
      frame(3000, 1.5),
    ]);

    expect(features.captureDurationMs).toBe(3000);
    expect(features.activeDurationMs).toBe(500);
    expect(features.endingBehavior).toBe("abrupt");
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "shape", polarity: "sharp" }),
    );
  });

  it("preserves a gradual active ending before a long inactive tail", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(200, 0.4),
      frame(400, 0.8),
      frame(700, 1),
      frame(1100, 1.1),
      frame(3000, 1.1),
    ]);

    expect(features.endingBehavior).toBe("gradual");
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "shape", polarity: "round" }),
    );
  });

  it("uses the final active burst and ignores an earlier burst", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.5),
      frame(200, 0.5),
      frame(300, 0.5),
      frame(400, 1),
      frame(500, 1.5),
      frame(600, 2),
      frame(700, 2.5),
      frame(800, 2.5),
    ]);

    expect(features.endingBehavior).toBe("abrupt");
  });

  it("distinguishes abrupt and gradual endings from segment speed", () => {
    const abrupt = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0.8),
      frame(300, 1.2),
    ]);
    const gradual = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0.8),
      frame(500, 0.9),
    ]);

    expect(abrupt.endingBehavior).toBe("abrupt");
    expect(gradual.endingBehavior).toBe("gradual");
  });

  it("normalizes movement by shoulder width and keeps observable features inspectable", () => {
    const features = extractBodyMovementFeatures([frame(0, 0), frame(1000, 2)]);

    expect(features.activeJointCount).toBeGreaterThan(0);
    expect(features.spread).toBeGreaterThan(0);
    expect(features.peakSpeed).toBeGreaterThan(0);
  });

  it("measures movement extent rather than static body extent", () => {
    const staticFeatures = extractBodyMovementFeatures([frame(0, 0), frame(3000, 0)]);
    const smallFeatures = extractBodyMovementFeatures([frame(0, 0), frame(1000, 0.4)]);
    const broadFeatures = extractBodyMovementFeatures([frame(0, 0), frame(1000, 2)]);

    expect(staticFeatures.spread).toBe(0);
    expect(staticFeatures.hasMeaningfulMovement).toBe(false);
    expect(bodyToRepresentation(staticFeatures).dimensions).toEqual([]);
    expect(smallFeatures.spread).toBeLessThan(1.5);
    expect(broadFeatures.spread).toBeGreaterThanOrEqual(1.5);
    expect(bodyToRepresentation(broadFeatures).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "weight", polarity: "heavy" }),
    );
  });

  it("keeps unknown and insufficient dimensions unmapped", () => {
    const partial = bodyToRepresentation({
      frameCount: 2,
      captureDurationMs: 1000,
      activeDurationMs: 1000,
      totalMovement: 0.2,
      averageSpeed: 0.0002,
      peakSpeed: 0.0002,
      spread: 0,
      hasMeaningfulMovement: true,
      activeJointCount: 1,
      endingSpeedRatio: 0,
      endingBehavior: "unknown",
    });

    expect(partial.dimensions).toEqual([
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
    ]);
  });

  it("does not force semantics for an empty or unusable sequence", () => {
    const features = extractBodyMovementFeatures([frame(0, 0)]);

    expect(features.endingBehavior).toBe("unknown");
    expect(features.totalMovement).toBe(0);
    expect(features.captureDurationMs).toBe(0);
    expect(features.activeDurationMs).toBe(0);
  });

  it("describes observed body features without exposing raw internals", () => {
    const descriptions = humanizeBodyFeatures({
      frameCount: 10,
      captureDurationMs: 1000,
      activeDurationMs: 1000,
      totalMovement: 2,
      averageSpeed: 0.002,
      peakSpeed: 0.02,
      spread: 3,
      hasMeaningfulMovement: true,
      activeJointCount: 2,
      endingSpeedRatio: 0.4,
      endingBehavior: "gradual",
    });

    expect(descriptions).toContain("短い動きでした");
    expect(descriptions).toContain("最後はゆっくり収まりました");
    expect(descriptions.join(" ")).not.toContain("averageSpeed");
  });
});
