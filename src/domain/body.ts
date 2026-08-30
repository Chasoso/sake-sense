import type { GestureRepresentation } from "./gesture";

export type BodyLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type BodyPoseFrame = {
  t: number;
  landmarks: BodyLandmark[];
};

export type BodyMovementFeatures = {
  frameCount: number;
  durationMs: number;
  totalMovement: number;
  averageSpeed: number;
  peakSpeed: number;
  spread: number;
  activeJointCount: number;
  endingSpeedRatio: number;
  endingBehavior: "abrupt" | "gradual" | "unknown";
};

export function humanizeBodyFeatures(features: BodyMovementFeatures): string[] {
  const summaries = [
    features.durationMs <= 1800 ? "短い動きでした" : "ゆっくり続く動きでした",
    features.spread >= 2.5 ? "大きく広がりました" : "まとまった範囲で動きました",
    features.peakSpeed >= 0.01 ? "速い動きが含まれていました" : "ゆっくりした動きでした",
  ];
  if (features.endingBehavior === "abrupt") summaries.push("最後にすっと止まりました");
  if (features.endingBehavior === "gradual") summaries.push("最後はゆっくり収まりました");
  return summaries;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;

function finite(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
}

function distance(from: BodyLandmark, to: BodyLandmark): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function normalizeFrame(frame: BodyPoseFrame): BodyPoseFrame | null {
  const left = frame.landmarks[LEFT_SHOULDER];
  const right = frame.landmarks[RIGHT_SHOULDER];
  if (!left || !right) return null;
  const center = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const scale = Math.max(distance(left, right), 0.01);
  return {
    t: Math.max(finite(frame.t), 0),
    landmarks: frame.landmarks.map((landmark) => ({
      x: (finite(landmark.x) - center.x) / scale,
      y: (finite(landmark.y) - center.y) / scale,
      z: finite(landmark.z),
      visibility: finite(landmark.visibility ?? 1),
    })),
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function extractBodyMovementFeatures(frames: BodyPoseFrame[]): BodyMovementFeatures {
  const normalized = frames
    .map(normalizeFrame)
    .filter((frame): frame is BodyPoseFrame => frame !== null);
  if (normalized.length < 2) {
    return {
      frameCount: normalized.length,
      durationMs: 0,
      totalMovement: 0,
      averageSpeed: 0,
      peakSpeed: 0,
      spread: 0,
      activeJointCount: 0,
      endingSpeedRatio: 0,
      endingBehavior: "unknown",
    };
  }

  const segmentSpeeds: number[] = [];
  const segmentMovements: number[] = [];
  const jointMovement = new Array(normalized[0].landmarks.length).fill(0) as number[];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const elapsed = current.t - previous.t;
    if (elapsed <= 0) continue;
    let movement = 0;
    current.landmarks.forEach((landmark, jointIndex) => {
      const previousLandmark = previous.landmarks[jointIndex];
      if (!previousLandmark) return;
      const jointDistance = distance(previousLandmark, landmark);
      movement += jointDistance;
      jointMovement[jointIndex] += jointDistance;
    });
    segmentMovements.push(movement);
    segmentSpeeds.push(movement / elapsed);
  }

  const validTimes = normalized.map((frame) => frame.t);
  const durationMs = Math.max(validTimes.at(-1)! - validTimes[0], 0);
  const allX = normalized.flatMap((frame) => frame.landmarks.map((landmark) => landmark.x));
  const allY = normalized.flatMap((frame) => frame.landmarks.map((landmark) => landmark.y));
  const spread = Math.hypot(
    Math.max(...allX) - Math.min(...allX),
    Math.max(...allY) - Math.min(...allY),
  );
  const endingStart = Math.floor(segmentSpeeds.length * 0.75);
  const representative = median(segmentSpeeds.slice(0, Math.max(endingStart, 1)));
  const ending = segmentSpeeds.slice(endingStart);
  const endingSpeed = ending.length
    ? ending.reduce((sum, speed) => sum + speed, 0) / ending.length
    : 0;
  const endingSpeedRatio = representative > 0 ? endingSpeed / representative : 0;

  return {
    frameCount: normalized.length,
    durationMs,
    totalMovement: segmentMovements.reduce((sum, movement) => sum + movement, 0),
    averageSpeed:
      durationMs > 0
        ? segmentMovements.reduce((sum, movement) => sum + movement, 0) / durationMs
        : 0,
    peakSpeed: segmentSpeeds.length ? Math.max(...segmentSpeeds) : 0,
    spread,
    activeJointCount: jointMovement.filter((movement) => movement >= 0.08).length,
    endingSpeedRatio,
    endingBehavior:
      representative === 0 ? "unknown" : endingSpeedRatio >= 0.75 ? "abrupt" : "gradual",
  };
}

export function bodyToRepresentation(features: BodyMovementFeatures): GestureRepresentation {
  const isShort = features.durationMs <= 1800;
  const isSharp = features.endingBehavior === "abrupt";
  const isBroad = features.spread >= 2.5;
  return {
    dimensions: [
      {
        dimensionId: "duration",
        polarity: isShort ? "short" : "lingering",
        reason: `body movement duration ${Math.round(features.durationMs)}ms (experimental hint)`,
      },
      {
        dimensionId: "shape",
        polarity: isSharp ? "sharp" : "round",
        reason: isSharp
          ? `body movement ending speed ratio ${features.endingSpeedRatio.toFixed(2)}`
          : `body movement slowed at the ending (ratio ${features.endingSpeedRatio.toFixed(2)})`,
      },
      {
        dimensionId: "weight",
        polarity: isBroad ? "heavy" : "light",
        reason: `body movement normalized spread ${features.spread.toFixed(2)} (experimental hint)`,
      },
    ],
    tags: [
      isShort ? "body-short" : "body-lingering",
      isSharp ? "body-sharp-ending" : "body-soft-ending",
      isBroad ? "body-broad" : "body-contained",
    ],
  };
}
