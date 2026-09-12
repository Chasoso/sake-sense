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

type NormalizedBodyPoseFrame = BodyPoseFrame & {
  bodyCenter: { x: number; y: number };
};

export type BodyMotionShape = {
  expansion: "expanding" | "contracting" | "unknown";
  dominantDirection: "upward" | "downward" | "lateral" | "unknown";
  repetition: "single" | "repeated" | "unknown";
  participation: "localized" | "broad" | "unknown";
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
  motionShape: BodyMotionShape;
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
  if (features.motionShape.expansion === "expanding")
    summaries.push("腕や身体が外へ広がる動きでした");
  if (features.motionShape.expansion === "contracting")
    summaries.push("身体の中心へ縮まる動きでした");
  if (features.motionShape.dominantDirection === "upward")
    summaries.push("上方向へ伸びる動きでした");
  if (features.motionShape.dominantDirection === "downward")
    summaries.push("下方向へ動く傾向がありました");
  if (features.motionShape.dominantDirection === "lateral")
    summaries.push("横方向へ動く傾向がありました");
  if (features.motionShape.repetition === "single") summaries.push("一度のまとまった動きでした");
  if (features.motionShape.repetition === "repeated")
    summaries.push("動きが何度か繰り返されました");
  if (features.motionShape.participation === "localized")
    summaries.push("身体の一部を中心に動きました");
  if (features.motionShape.participation === "broad") summaries.push("上半身を広く使う動きでした");
  return summaries;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
export const BODY_MOVEMENT_ACTIVITY_THRESHOLD = 0.01;
export const BODY_SHORT_DURATION_THRESHOLD_MS = 1800;
export const BODY_BROAD_MOVEMENT_THRESHOLD = 1.5;
export const BODY_ABRUPT_ENDING_RATIO = 0.75;
export const BODY_MOTION_SHAPE_CHANGE_THRESHOLD = 0.15;
export const BODY_MOTION_DIRECTION_THRESHOLD = 0.2;
export const BODY_MOTION_DIRECTION_DOMINANCE_RATIO = 1.25;
export const BODY_MOTION_REVERSAL_THRESHOLD = 0.08;
export const BODY_BROAD_PARTICIPATION_RATIO = 0.5;
export const BODY_GLOBAL_MOVEMENT_ACTIVITY_THRESHOLD = 0.04;

function finite(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
}

function distance(from: BodyLandmark, to: BodyLandmark): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function shoulderGeometry(frame: BodyPoseFrame): {
  center: { x: number; y: number };
  scale: number;
} | null {
  const left = frame.landmarks[LEFT_SHOULDER];
  const right = frame.landmarks[RIGHT_SHOULDER];
  if (!left || !right) return null;
  const center = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  return { center, scale: Math.max(distance(left, right), 0.01) };
}

function normalizeFrame(
  frame: BodyPoseFrame,
  stableScale: number,
  origin: { x: number; y: number },
): NormalizedBodyPoseFrame | null {
  const geometry = shoulderGeometry(frame);
  if (!geometry) return null;
  return {
    t: Math.max(finite(frame.t), 0),
    landmarks: frame.landmarks.map((landmark) => ({
      x: (finite(landmark.x) - geometry.center.x) / geometry.scale,
      y: (finite(landmark.y) - geometry.center.y) / geometry.scale,
      z: finite(landmark.z),
      visibility: finite(landmark.visibility ?? 1),
    })),
    bodyCenter: {
      x: (geometry.center.x - origin.x) / stableScale,
      y: (geometry.center.y - origin.y) / stableScale,
    },
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const MOTION_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const ARM_JOINTS = [13, 15, 14, 16];
const MOTION_REGIONS = [
  [13, 15],
  [14, 16],
  [11, 12, 23, 24],
  [25, 26, 27, 28],
];

function unknownMotionShape(): BodyMotionShape {
  return {
    expansion: "unknown",
    dominantDirection: "unknown",
    repetition: "unknown",
    participation: "unknown",
  };
}

function meanRadialDistance(frame: BodyPoseFrame): number {
  const distances = ARM_JOINTS.map((index) => frame.landmarks[index])
    .filter((landmark): landmark is BodyLandmark => landmark !== undefined)
    .map((landmark) => Math.hypot(landmark.x, landmark.y));
  return distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
}

function extractMotionShape(
  normalized: NormalizedBodyPoseFrame[],
  segmentMovements: number[],
  jointMovement: number[],
): BodyMotionShape {
  const activeFrameIndexes = new Set<number>();
  segmentMovements.forEach((movement, index) => {
    if (movement >= BODY_MOVEMENT_ACTIVITY_THRESHOLD) {
      activeFrameIndexes.add(index);
      activeFrameIndexes.add(index + 1);
    }
  });
  const activeFrames = [...activeFrameIndexes].sort((left, right) => left - right);
  if (activeFrames.length < 2) return unknownMotionShape();

  const firstFrame = normalized[activeFrames[0]];
  const lastFrame = normalized[activeFrames.at(-1)!];
  const radialChange = meanRadialDistance(lastFrame) - meanRadialDistance(firstFrame);
  const expansion =
    radialChange >= BODY_MOTION_SHAPE_CHANGE_THRESHOLD
      ? "expanding"
      : radialChange <= -BODY_MOTION_SHAPE_CHANGE_THRESHOLD
        ? "contracting"
        : "unknown";

  const movingJoints = MOTION_JOINTS.filter(
    (index) => (jointMovement[index] ?? 0) >= BODY_MOTION_REVERSAL_THRESHOLD,
  );
  const directionDisplacement = movingJoints.reduce(
    (sum, index) => {
      const start = firstFrame.landmarks[index];
      const end = lastFrame.landmarks[index];
      if (!start || !end) return sum;
      return { x: sum.x + end.x - start.x, y: sum.y + end.y - start.y };
    },
    { x: 0, y: 0 },
  );
  const centerStart = normalized[activeFrames[0]].bodyCenter;
  const centerEnd = normalized[activeFrames.at(-1)!].bodyCenter;
  const centerDisplacement = {
    x: centerEnd.x - centerStart.x,
    y: centerEnd.y - centerStart.y,
  };
  const relativeMagnitude = Math.hypot(directionDisplacement.x, directionDisplacement.y);
  const centerMagnitude = Math.hypot(centerDisplacement.x, centerDisplacement.y);
  const direction =
    centerMagnitude > relativeMagnitude && centerMagnitude >= BODY_MOTION_DIRECTION_THRESHOLD
      ? centerDisplacement
      : directionDisplacement;
  const xMagnitude = Math.abs(direction.x);
  const yMagnitude = Math.abs(direction.y);
  const dominantDirection =
    Math.max(xMagnitude, yMagnitude) < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : xMagnitude >= yMagnitude * BODY_MOTION_DIRECTION_DOMINANCE_RATIO
        ? "lateral"
        : yMagnitude >= xMagnitude * BODY_MOTION_DIRECTION_DOMINANCE_RATIO
          ? direction.y < 0
            ? "upward"
            : "downward"
          : "unknown";

  let representativeJoint = movingJoints[0];
  let representativePath = 0;
  movingJoints.forEach((jointIndex) => {
    let path = 0;
    for (let index = 1; index < activeFrames.length; index += 1) {
      const previous = normalized[activeFrames[index - 1]].landmarks[jointIndex];
      const current = normalized[activeFrames[index]].landmarks[jointIndex];
      if (previous && current) path += distance(previous, current);
    }
    if (path > representativePath) {
      representativeJoint = jointIndex;
      representativePath = path;
    }
  });
  const centerTrajectory = activeFrames.map((frameIndex) => normalized[frameIndex].bodyCenter);
  let trajectory =
    representativeJoint === undefined
      ? centerTrajectory
      : activeFrames
          .map((frameIndex) => normalized[frameIndex].landmarks[representativeJoint])
          .filter((landmark): landmark is BodyLandmark => landmark !== undefined);
  const centerPath = centerTrajectory.reduce(
    (path, point, index) =>
      index === 0 ? path : path + distance(centerTrajectory[index - 1], point),
    0,
  );
  if (centerPath > representativePath) {
    representativePath = centerPath;
    trajectory = centerTrajectory;
  }
  const xRange = trajectory.length
    ? Math.max(...trajectory.map((point) => point.x)) -
      Math.min(...trajectory.map((point) => point.x))
    : 0;
  const yRange = trajectory.length
    ? Math.max(...trajectory.map((point) => point.y)) -
      Math.min(...trajectory.map((point) => point.y))
    : 0;
  const axis = xRange >= yRange ? "x" : "y";
  const signs: number[] = [];
  for (let index = 1; index < trajectory.length; index += 1) {
    const delta = trajectory[index][axis] - trajectory[index - 1][axis];
    if (Math.abs(delta) >= BODY_MOTION_REVERSAL_THRESHOLD) signs.push(Math.sign(delta));
  }
  let reversals = 0;
  for (let index = 1; index < signs.length; index += 1) {
    if (signs[index] !== signs[index - 1]) reversals += 1;
  }
  const repetition =
    representativePath < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : reversals >= 2
        ? "repeated"
        : "single";

  const activeRegions = MOTION_REGIONS.filter((region) =>
    region.some((index) => (jointMovement[index] ?? 0) >= BODY_MOTION_REVERSAL_THRESHOLD),
  ).length;
  const participation =
    activeRegions === 0
      ? "unknown"
      : activeRegions / MOTION_REGIONS.length >= BODY_BROAD_PARTICIPATION_RATIO
        ? "broad"
        : "localized";

  return { expansion, dominantDirection, repetition, participation };
}

export function extractBodyMovementFeatures(frames: BodyPoseFrame[]): BodyMovementFeatures {
  const validFrames = frames.filter((frame) => shoulderGeometry(frame) !== null);
  const geometries = validFrames.map((frame) => shoulderGeometry(frame)!);
  const stableScale = median(geometries.map(({ scale }) => scale)) || 1;
  const origin = geometries[0]?.center ?? { x: 0, y: 0 };
  const normalized = validFrames
    .map((frame) => normalizeFrame(frame, stableScale, origin))
    .filter((frame): frame is NormalizedBodyPoseFrame => frame !== null);
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
      motionShape: unknownMotionShape(),
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
    const centerMovement = distance(previous.bodyCenter, current.bodyCenter);
    if (centerMovement >= BODY_GLOBAL_MOVEMENT_ACTIVITY_THRESHOLD) {
      movement += centerMovement;
      movementSpread = Math.max(movementSpread, distance({ x: 0, y: 0 }, current.bodyCenter));
    }
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
    motionShape: extractMotionShape(normalized, segmentMovements, jointMovement),
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
