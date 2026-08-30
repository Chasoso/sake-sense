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
  captureDurationMs: number;
  activeDurationMs: number;
  totalMovement: number;
  averageSpeed: number;
  peakSpeed: number;
  spread: number;
  hasMeaningfulMovement: boolean;
  activeJointCount: number;
  endingSpeedRatio: number;
  endingBehavior: "abrupt" | "gradual" | "unknown";
};

export function humanizeBodyFeatures(features: BodyMovementFeatures): string[] {
  if (!features.hasMeaningfulMovement) return ["はっきりした動きを十分に捉えられませんでした"];
  const summaries = [
    features.activeDurationMs <= BODY_SHORT_DURATION_THRESHOLD_MS
      ? "短い動きでした"
      : "ゆっくり続く動きでした",
    features.spread >= BODY_BROAD_MOVEMENT_THRESHOLD
      ? "大きく広がりました"
      : "まとまった範囲で動きました",
    features.peakSpeed >= 0.01 ? "速い動きが含まれていました" : "ゆっくりした動きでした",
  ];
  if (features.endingBehavior === "abrupt") summaries.push("最後にすっと止まりました");
  if (features.endingBehavior === "gradual") summaries.push("最後はゆっくり収まりました");
  return summaries;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
export const BODY_MOVEMENT_ACTIVITY_THRESHOLD = 0.01;
export const BODY_SHORT_DURATION_THRESHOLD_MS = 1800;
export const BODY_BROAD_MOVEMENT_THRESHOLD = 1.5;
export const BODY_ABRUPT_ENDING_RATIO = 0.75;

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
      captureDurationMs: 0,
      activeDurationMs: 0,
      totalMovement: 0,
      averageSpeed: 0,
      peakSpeed: 0,
      spread: 0,
      hasMeaningfulMovement: false,
      activeJointCount: 0,
      endingSpeedRatio: 0,
      endingBehavior: "unknown",
    };
  }

  const segmentSpeeds: number[] = [];
  const segmentMovements: number[] = [];
  const segmentDurations: number[] = [];
  const jointMovement = new Array(normalized[0].landmarks.length).fill(0) as number[];
  const startingLandmarks = normalized[0].landmarks;
  let movementSpread = 0;
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
      movementSpread = Math.max(movementSpread, distance(startingLandmarks[jointIndex], landmark));
    });
    segmentMovements.push(movement);
    segmentSpeeds.push(movement / elapsed);
    segmentDurations.push(elapsed);
  }

  const validTimes = normalized.map((frame) => frame.t);
  const captureDurationMs = Math.max(validTimes.at(-1)! - validTimes[0], 0);
  const activeDurationMs = segmentMovements.reduce(
    (duration, movement, index) =>
      duration + (movement >= BODY_MOVEMENT_ACTIVITY_THRESHOLD ? segmentDurations[index] : 0),
    0,
  );
  const activeMovement = segmentMovements.reduce(
    (movement, segment) => movement + (segment >= BODY_MOVEMENT_ACTIVITY_THRESHOLD ? segment : 0),
    0,
  );
  const activeIndexes = segmentMovements
    .map((movement, index) => (movement >= BODY_MOVEMENT_ACTIVITY_THRESHOLD ? index : -1))
    .filter((index) => index >= 0);
  const lastActiveIndex = activeIndexes.at(-1);
  const finalSequence: number[] = [];
  for (
    let index = lastActiveIndex;
    index !== undefined && segmentMovements[index] >= BODY_MOVEMENT_ACTIVITY_THRESHOLD;
    index -= 1
  ) {
    finalSequence.unshift(index);
  }
  const activeSpeeds = finalSequence.map((index) => segmentSpeeds[index]);
  const endingStart = Math.floor(activeSpeeds.length * 0.75);
  const representative = median(activeSpeeds.slice(0, Math.max(endingStart, 1)));
  const ending = activeSpeeds.slice(endingStart);
  const endingSpeed = ending.length
    ? ending.reduce((sum, speed) => sum + speed, 0) / ending.length
    : 0;
  const endingSpeedRatio = representative > 0 ? endingSpeed / representative : 0;

  return {
    frameCount: normalized.length,
    totalMovement: segmentMovements.reduce((sum, movement) => sum + movement, 0),
    averageSpeed: activeDurationMs > 0 ? activeMovement / activeDurationMs : 0,
    peakSpeed: segmentSpeeds.length ? Math.max(...segmentSpeeds) : 0,
    activeJointCount: jointMovement.filter((movement) => movement >= 0.08).length,
    endingSpeedRatio,
    endingBehavior:
      activeSpeeds.length < 3
        ? "unknown"
        : representative === 0
          ? "unknown"
          : endingSpeedRatio >= BODY_ABRUPT_ENDING_RATIO
            ? "abrupt"
            : "gradual",
    captureDurationMs,
    activeDurationMs,
    spread: movementSpread,
    hasMeaningfulMovement: activeDurationMs > 0 && movementSpread > 0,
  };
}

export function bodyToRepresentation(features: BodyMovementFeatures): GestureRepresentation {
  const dimensions: GestureRepresentation["dimensions"] = [];
  if (features.hasMeaningfulMovement && features.activeDurationMs > 0) {
    dimensions.push({
      dimensionId: "duration",
      polarity:
        features.activeDurationMs <= BODY_SHORT_DURATION_THRESHOLD_MS ? "short" : "lingering",
      reason: `active body movement duration ${Math.round(features.activeDurationMs)}ms (experimental hint)`,
    });
  }
  if (features.hasMeaningfulMovement && features.endingBehavior !== "unknown") {
    dimensions.push({
      dimensionId: "shape",
      polarity: features.endingBehavior === "abrupt" ? "sharp" : "round",
      reason:
        features.endingBehavior === "abrupt"
          ? `body movement ending speed ratio ${features.endingSpeedRatio.toFixed(2)}`
          : `body movement slowed at the ending (ratio ${features.endingSpeedRatio.toFixed(2)})`,
    });
  }
  if (features.hasMeaningfulMovement && features.spread > 0) {
    dimensions.push({
      dimensionId: "weight",
      polarity: features.spread >= BODY_BROAD_MOVEMENT_THRESHOLD ? "heavy" : "light",
      reason: `body movement trajectory spread ${features.spread.toFixed(2)} (experimental hint)`,
    });
  }
  return {
    dimensions,
    tags: [
      ...(features.activeDurationMs > 0
        ? [
            features.activeDurationMs <= BODY_SHORT_DURATION_THRESHOLD_MS
              ? "body-short"
              : "body-lingering",
          ]
        : []),
      ...(features.endingBehavior === "abrupt"
        ? ["body-sharp-ending"]
        : features.endingBehavior === "gradual"
          ? ["body-soft-ending"]
          : []),
      ...(features.hasMeaningfulMovement
        ? [features.spread >= BODY_BROAD_MOVEMENT_THRESHOLD ? "body-broad" : "body-contained"]
        : []),
    ],
  };
}
