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

    expect(features.durationMs).toBe(500);
    expect(features.totalMovement).toBeGreaterThan(0);
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
    );
  });

  it("extracts a sustained movement and maps it to lingering duration", () => {
    const features = extractBodyMovementFeatures([frame(0, 0), frame(1500, 0.4), frame(3000, 0.8)]);

    expect(features.durationMs).toBe(3000);
    expect(bodyToRepresentation(features).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "lingering" }),
    );
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

  it("does not force semantics for an empty or unusable sequence", () => {
    const features = extractBodyMovementFeatures([frame(0, 0)]);

    expect(features.endingBehavior).toBe("unknown");
    expect(features.totalMovement).toBe(0);
    expect(features.durationMs).toBe(0);
  });

  it("describes observed body features without exposing raw internals", () => {
    const descriptions = humanizeBodyFeatures({
      frameCount: 10,
      durationMs: 1000,
      totalMovement: 2,
      averageSpeed: 0.002,
      peakSpeed: 0.02,
      spread: 3,
      activeJointCount: 2,
      endingSpeedRatio: 0.4,
      endingBehavior: "gradual",
    });

    expect(descriptions).toContain("短い動きでした");
    expect(descriptions).toContain("最後はゆっくり収まりました");
    expect(descriptions.join(" ")).not.toContain("averageSpeed");
  });
});
