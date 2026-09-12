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
  landmarks[23] = { x: -0.3, y: 1 };
  landmarks[24] = { x: 0.3, y: 1 };
  landmarks[15] = { x: wristX, y: -0.5 };
  return { t, landmarks };
}

function shapeFrame(t: number, positions: Record<number, { x: number; y: number }>): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  landmarks[11] = { x: -0.5, y: 0 };
  landmarks[12] = { x: 0.5, y: 0 };
  landmarks[23] = { x: -0.3, y: 1 };
  landmarks[24] = { x: 0.3, y: 1 };
  Object.entries(positions).forEach(([index, position]) => {
    landmarks[Number(index)] = position;
  });
  return { t, landmarks };
}

function translatedFrame(t: number, offsetX: number): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: offsetX, y: 0 }));
  landmarks[11] = { x: offsetX - 0.5, y: 0 };
  landmarks[12] = { x: offsetX + 0.5, y: 0 };
  landmarks[23] = { x: offsetX - 0.3, y: 1 };
  landmarks[24] = { x: offsetX + 0.3, y: 1 };
  landmarks[15] = { x: offsetX - 0.4, y: -0.5 };
  landmarks[16] = { x: offsetX + 0.4, y: -0.5 };
  return { t, landmarks };
}

function jitterFrame(t: number, phase: number): BodyPoseFrame {
  const landmarks: BodyLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0 }));
  landmarks[11] = { x: -0.5, y: 0 };
  landmarks[12] = { x: 0.5, y: 0 };
  for (const index of [13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    landmarks[index] = {
      x: ((index % 3) - 1) * 0.002 * phase,
      y: (index % 2 === 0 ? 1 : -1) * 0.002 * phase,
    };
  }
  return { t, landmarks };
}

function rotateFrame(frameToRotate: BodyPoseFrame, angle: number): BodyPoseFrame {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    ...frameToRotate,
    landmarks: frameToRotate.landmarks.map((landmark) => ({
      ...landmark,
      x: cosine * landmark.x - sine * landmark.y,
      y: sine * landmark.x + cosine * landmark.y,
    })),
  };
}

function translateFrame(frameToTranslate: BodyPoseFrame, offsetX: number): BodyPoseFrame {
  return {
    ...frameToTranslate,
    landmarks: frameToTranslate.landmarks.map((landmark) => ({
      ...landmark,
      x: landmark.x + offsetX,
    })),
  };
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
      frame(1000, 2.5),
    ]);

    expect(features.endingBehavior).toBe("abrupt");
  });

  it("distinguishes abrupt and gradual endings from segment speed", () => {
    const abrupt = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0.8),
      frame(300, 1.2),
      frame(500, 1.2),
    ]);
    const gradual = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0.8),
      frame(500, 0.9),
      frame(700, 0.9),
    ]);

    expect(abrupt.endingBehavior).toBe("abrupt");
    expect(gradual.endingBehavior).toBe("gradual");
  });

  it("marks movement that reaches capture end as continued", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0.8),
      frame(300, 1.2),
    ]);

    expect(features.endingBehavior).toBe("continued");
    expect(humanizeBodyFeatures(features)).toContain("最後まで動きが続いていました");
    expect(bodyToRepresentation(features).dimensions).not.toContainEqual(
      expect.objectContaining({ dimensionId: "shape" }),
    );
    expect(bodyToRepresentation(features).tags).not.toContain("body-sharp-ending");
    expect(bodyToRepresentation(features).tags).not.toContain("body-soft-ending");
  });

  it("does not describe multi-joint pose jitter as fast or broad movement", () => {
    const features = extractBodyMovementFeatures([
      jitterFrame(0, 1),
      jitterFrame(100, -1),
      jitterFrame(200, 1),
      jitterFrame(300, -1),
      jitterFrame(400, 1),
    ]);
    const descriptions = humanizeBodyFeatures(features);

    expect(features.hasSustainedFastMovement).toBe(false);
    expect(features.motionShape.participation).toBe("unknown");
    expect(descriptions).not.toContain("速い動きが含まれていました");
    expect(descriptions).not.toContain("上半身を広く使う動きでした");
  });

  it("does not accumulate jitter across a long static capture", () => {
    const features = extractBodyMovementFeatures(
      Array.from({ length: 41 }, (_, index) => jitterFrame(index * 100, index % 2 ? -1 : 1)),
    );

    expect(features.totalMovement).toBe(0);
    expect(features.hasMeaningfulMovement).toBe(false);
    expect(features.endingBehavior).toBe("unknown");
    expect(features.motionShape).toEqual({
      expansion: "unknown",
      dominantDirection: "unknown",
      repetition: "unknown",
      participation: "unknown",
    });
    expect(features.hasSustainedFastMovement).toBe(false);
  });

  it("keeps coherent small hand movement as localized movement", () => {
    const features = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: 0, y: -0.5 } }),
      shapeFrame(100, { 15: { x: 0.03, y: -0.5 } }),
      shapeFrame(200, { 15: { x: 0.06, y: -0.5 } }),
      shapeFrame(300, { 15: { x: 0.09, y: -0.5 } }),
    ]);

    expect(features.hasMeaningfulMovement).toBe(true);
    expect(features.motionShape.participation).toBe("localized");
    expect(features.hasSustainedFastMovement).toBe(false);
  });

  it("keeps coherent slow movement as meaningful but not fast", () => {
    const features = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: 0, y: -0.5 } }),
      shapeFrame(500, { 15: { x: 0.04, y: -0.5 } }),
      shapeFrame(1000, { 15: { x: 0.08, y: -0.5 } }),
      shapeFrame(1500, { 15: { x: 0.12, y: -0.5 } }),
    ]);

    expect(features.hasMeaningfulMovement).toBe(true);
    expect(features.hasSustainedFastMovement).toBe(false);
  });

  it("ignores a one-frame pose spike for fast movement", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 1.5),
      frame(200, 0),
      frame(300, 0),
    ]);

    expect(features.peakSpeed).toBeGreaterThan(0.01);
    expect(features.hasSustainedFastMovement).toBe(false);
    expect(humanizeBodyFeatures(features)).not.toContain("速い動きが含まれていました");
  });

  it("describes coherent fast movement only after sustained evidence", () => {
    const features = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 1.2),
      frame(200, 2.4),
      frame(300, 3.6),
      frame(400, 4.8),
    ]);

    expect(features.hasSustainedFastMovement).toBe(true);
    expect(humanizeBodyFeatures(features)).toContain("速い動きが含まれていました");
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
    expect(staticFeatures.motionShape).toEqual({
      expansion: "unknown",
      dominantDirection: "unknown",
      repetition: "unknown",
      participation: "unknown",
    });
    expect(bodyToRepresentation(staticFeatures).dimensions).toEqual([]);
    expect(smallFeatures.spread).toBeLessThan(1.5);
    expect(broadFeatures.spread).toBeGreaterThanOrEqual(1.5);
    expect(bodyToRepresentation(broadFeatures).dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "weight", polarity: "heavy" }),
    );
  });

  it("describes outward and inward arm movement as expansion or contraction", () => {
    const outward = extractBodyMovementFeatures([
      shapeFrame(0, {
        13: { x: -0.3, y: -0.2 },
        14: { x: 0.3, y: -0.2 },
        15: { x: -0.4, y: -0.5 },
        16: { x: 0.4, y: -0.5 },
      }),
      shapeFrame(100, {
        13: { x: -0.5, y: -0.3 },
        14: { x: 0.5, y: -0.3 },
        15: { x: -0.7, y: -0.7 },
        16: { x: 0.7, y: -0.7 },
      }),
      shapeFrame(200, {
        13: { x: -0.7, y: -0.4 },
        14: { x: 0.7, y: -0.4 },
        15: { x: -1, y: -0.9 },
        16: { x: 1, y: -0.9 },
      }),
    ]);
    const inward = extractBodyMovementFeatures([
      shapeFrame(0, {
        13: { x: -0.7, y: -0.4 },
        14: { x: 0.7, y: -0.4 },
        15: { x: -1, y: -0.9 },
        16: { x: 1, y: -0.9 },
      }),
      shapeFrame(100, {
        13: { x: -0.5, y: -0.3 },
        14: { x: 0.5, y: -0.3 },
        15: { x: -0.7, y: -0.7 },
        16: { x: 0.7, y: -0.7 },
      }),
      shapeFrame(200, {
        13: { x: -0.3, y: -0.2 },
        14: { x: 0.3, y: -0.2 },
        15: { x: -0.4, y: -0.5 },
        16: { x: 0.4, y: -0.5 },
      }),
    ]);

    expect(outward.motionShape.expansion).toBe("expanding");
    expect(inward.motionShape.expansion).toBe("contracting");
    expect(humanizeBodyFeatures(outward)).toContain("腕や身体が外へ広がる動きでした");
    expect(humanizeBodyFeatures(inward)).toContain("身体の中心へ縮まる動きでした");
  });

  it("describes coarse direction and participation", () => {
    const upward = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: -0.4, y: 0.7 }, 16: { x: 0.4, y: 0.7 } }),
      shapeFrame(100, { 15: { x: -0.4, y: 0.3 }, 16: { x: 0.4, y: 0.3 } }),
      shapeFrame(200, { 15: { x: -0.4, y: -0.7 }, 16: { x: 0.4, y: -0.7 } }),
    ]);
    const lateral = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: 0, y: -0.2 } }),
      shapeFrame(100, { 15: { x: 0.4, y: -0.2 } }),
      shapeFrame(200, { 15: { x: 0.8, y: -0.2 } }),
    ]);
    const localized = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: 0, y: 0 } }),
      shapeFrame(100, { 15: { x: 0.5, y: 0 } }),
      shapeFrame(200, { 15: { x: 1, y: 0 } }),
    ]);
    const broad = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: -0.4, y: 0 }, 16: { x: 0.4, y: 0 } }),
      shapeFrame(100, { 15: { x: -0.8, y: 0 }, 16: { x: 0.8, y: 0 } }),
      shapeFrame(200, { 15: { x: -1, y: 0 }, 16: { x: 1, y: 0 } }),
    ]);

    expect(upward.motionShape.dominantDirection).toBe("upward");
    expect(lateral.motionShape.dominantDirection).toBe("lateral");
    expect(localized.motionShape.participation).toBe("localized");
    expect(broad.motionShape.participation).toBe("broad");
  });

  it("uses body-relative upward direction when the camera is level or rotated", () => {
    const level = [
      shapeFrame(0, { 15: { x: -0.4, y: 0.6 } }),
      shapeFrame(100, { 15: { x: -0.4, y: 0.1 } }),
      shapeFrame(200, { 15: { x: -0.4, y: -0.5 } }),
    ];
    const rotated = level.map((pose) => rotateFrame(pose, Math.PI / 7));

    expect(extractBodyMovementFeatures(level).motionShape.dominantDirection).toBe("upward");
    expect(extractBodyMovementFeatures(rotated).motionShape.dominantDirection).toBe("upward");
  });

  it("keeps a lateral arm sweep lateral under camera rotation", () => {
    const level = [
      shapeFrame(0, { 15: { x: -0.4, y: -0.5 } }),
      shapeFrame(100, { 15: { x: 0.1, y: -0.5 } }),
      shapeFrame(200, { 15: { x: 0.7, y: -0.5 } }),
    ];
    const rotated = level.map((pose) => rotateFrame(pose, -Math.PI / 7));

    expect(extractBodyMovementFeatures(rotated).motionShape.dominantDirection).toBe("lateral");
  });

  it("uses body-relative downward direction", () => {
    const features = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: -0.4, y: -0.5 } }),
      shapeFrame(100, { 15: { x: -0.4, y: 0.1 } }),
      shapeFrame(200, { 15: { x: -0.4, y: 0.7 } }),
    ]);

    expect(features.motionShape.dominantDirection).toBe("downward");
  });

  it("keeps strong upward limb motion ahead of slight lateral torso drift", () => {
    const features = extractBodyMovementFeatures([
      translateFrame(shapeFrame(0, { 15: { x: -0.4, y: 0.6 } }), 0),
      translateFrame(shapeFrame(100, { 15: { x: -0.4, y: 0.1 } }), 0.05),
      translateFrame(shapeFrame(200, { 15: { x: -0.4, y: -0.5 } }), 0.1),
    ]);

    expect(features.motionShape.dominantDirection).toBe("upward");
  });

  it("leaves equally strong limb and center directions ambiguous", () => {
    const features = extractBodyMovementFeatures([
      translateFrame(shapeFrame(0, { 15: { x: -0.4, y: 0.6 } }), 0),
      translateFrame(shapeFrame(100, { 15: { x: -0.4, y: 0.1 } }), 0.5),
      translateFrame(shapeFrame(200, { 15: { x: -0.4, y: -0.5 } }), 1),
    ]);

    expect(features.motionShape.dominantDirection).toBe("unknown");
  });

  it("detects meaningful repetition but ignores tiny movement", () => {
    const repeated = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.4),
      frame(200, 0),
      frame(300, -0.4),
      frame(400, 0),
      frame(500, 0.4),
    ]);
    const tiny = extractBodyMovementFeatures([
      frame(0, 0),
      frame(100, 0.02),
      frame(200, 0),
      frame(300, -0.02),
    ]);

    expect(repeated.motionShape.repetition).toBe("repeated");
    expect(tiny.motionShape.repetition).not.toBe("repeated");
  });

  it("preserves whole-body sway through a separately normalized center trajectory", () => {
    const sway = extractBodyMovementFeatures([
      translatedFrame(0, 0),
      translatedFrame(100, 0.3),
      translatedFrame(200, -0.3),
      translatedFrame(300, 0.3),
    ]);
    const jitter = extractBodyMovementFeatures([
      translatedFrame(0, 0),
      translatedFrame(100, 0.01),
      translatedFrame(200, -0.01),
      translatedFrame(300, 0.01),
    ]);

    expect(sway.hasMeaningfulMovement).toBe(true);
    expect(sway.motionShape.dominantDirection).toBe("lateral");
    expect(sway.motionShape.repetition).toBe("repeated");
    expect(jitter.hasMeaningfulMovement).toBe(false);
    expect(jitter.motionShape.repetition).not.toBe("repeated");
  });

  it("distinguishes arm expansion from a lateral sweep with similar timing", () => {
    const outward = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: -0.4, y: -0.5 }, 16: { x: 0.4, y: -0.5 } }),
      shapeFrame(100, { 15: { x: -0.7, y: -0.7 }, 16: { x: 0.7, y: -0.7 } }),
      shapeFrame(200, { 15: { x: -1, y: -0.9 }, 16: { x: 1, y: -0.9 } }),
    ]);
    const lateralSweep = extractBodyMovementFeatures([
      shapeFrame(0, { 15: { x: -0.4, y: -0.5 } }),
      shapeFrame(100, { 15: { x: 0.2, y: -0.5 } }),
      shapeFrame(200, { 15: { x: 0.8, y: -0.5 } }),
    ]);

    expect(outward.captureDurationMs).toBe(lateralSweep.captureDurationMs);
    expect(outward.activeDurationMs).toBe(lateralSweep.activeDurationMs);
    expect(outward.endingBehavior).toBe(lateralSweep.endingBehavior);
    expect(outward.motionShape.expansion).toBe("expanding");
    expect(lateralSweep.motionShape.dominantDirection).toBe("lateral");
    expect(lateralSweep.motionShape.expansion).not.toBe("expanding");
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
      motionShape: {
        expansion: "unknown",
        dominantDirection: "unknown",
        repetition: "unknown",
        participation: "unknown",
      },
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
      motionShape: {
        expansion: "unknown",
        dominantDirection: "unknown",
        repetition: "unknown",
        participation: "localized",
      },
    });

    expect(descriptions).toContain("短い動きでした");
    expect(descriptions).toContain("最後はゆっくり収まりました");
    expect(descriptions.join(" ")).not.toContain("averageSpeed");
  });
});
