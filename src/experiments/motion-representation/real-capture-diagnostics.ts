import {
  BODY_FAST_SPEED_THRESHOLD,
  BODY_REGION_ACTIVITY_THRESHOLD,
  extractBodyMovementFeatures,
  type BodyPoseFrame,
  type BodyMovementFeatures,
} from "../../domain/body";
import { buildSensoryBridgeInput, type SensoryBridgeInput } from "../../domain/sensory-bridge";
import { describeMotion } from "./descriptors";
import { normalizeMotionSequence } from "./normalize";
import { createMotionSignature } from "./signature";
import type { MotionSignature, ExtendedMotionDescriptors } from "./types";

type NumericMap = Record<string, number>;

export type CaptureDiagnosticMetadata = {
  frameCount: number;
  captureDurationMs: number;
  approximateFrameRate: number;
  validFrameCount: number;
  invalidFrameCount: number;
};

export type JointMovementDiagnostic = {
  cumulativeMovement: NumericMap;
  activeJointsByCurrentThreshold: string[];
  topMovingJoints: Array<{ joint: string; movement: number; contributionRatio: number }>;
};

export type RegionActivityDiagnostic = Record<
  "leftArm" | "rightArm" | "torso" | "lowerBody",
  { cumulativeMovement: number; activeSegmentCount: number; activityRatio: number }
>;

export type SpeedDiagnostic = {
  meanSegmentSpeed: number;
  medianSegmentSpeed: number;
  p90SegmentSpeed: number;
  currentFastThreshold: number;
  fastSegmentCount: number;
  fastDurationMs: number;
};

export type DirectionDiagnostic = {
  relativeHorizontal: number;
  relativeVertical: number;
  centerHorizontal: number;
  centerVertical: number;
  selectedSource: "joint" | "center" | "none";
};

export type MotionExperimentDiagnostic = {
  capture: CaptureDiagnosticMetadata;
  current: BodyMovementFeatures;
  coarse: SensoryBridgeInput;
  extended: ExtendedMotionDescriptors;
  signature: MotionSignature;
  jointMovement: JointMovementDiagnostic;
  regionActivity: RegionActivityDiagnostic;
  speed: SpeedDiagnostic;
  directionDebug: DirectionDiagnostic;
  summary: {
    coarse: SensoryBridgeInput;
    current: Pick<
      BodyMovementFeatures,
      "activeJointCount" | "averageSpeed" | "peakSpeed" | "endingBehavior"
    >;
    extended: Pick<ExtendedMotionDescriptors, "trajectory" | "dynamics" | "ending">;
    signature: Pick<MotionSignature, "phases" | "version">;
  };
};

const JOINT_NAMES: Record<number, string> = {
  0: "nose",
  11: "leftShoulder",
  12: "rightShoulder",
  13: "leftElbow",
  14: "rightElbow",
  15: "leftWrist",
  16: "rightWrist",
  23: "leftHip",
  24: "rightHip",
  25: "leftKnee",
  26: "rightKnee",
  27: "leftAnkle",
  28: "rightAnkle",
};

const REGION_INDICES = {
  leftArm: [13, 15],
  rightArm: [14, 16],
  torso: [11, 12, 23, 24],
  lowerBody: [25, 26, 27, 28],
} as const;

function nameForJoint(index: number): string {
  return JOINT_NAMES[index] ?? `landmark-${index}`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentileValue))];
}

function normalizeAllLandmarks(
  frames: BodyPoseFrame[],
): Array<{ t: number; points: Array<{ x: number; y: number }> }> {
  const valid = frames.filter((frame) => frame.landmarks[11] && frame.landmarks[12]);
  if (!valid.length) return [];
  const first = valid[0];
  const scale = Math.max(
    Math.hypot(
      first.landmarks[12].x - first.landmarks[11].x,
      first.landmarks[12].y - first.landmarks[11].y,
    ),
    0.001,
  );
  return valid.map((frame) => {
    const center = {
      x: (frame.landmarks[11].x + frame.landmarks[12].x) / 2,
      y: (frame.landmarks[11].y + frame.landmarks[12].y) / 2,
    };
    return {
      t: frame.t,
      points: frame.landmarks.map((landmark) => ({
        x: (landmark.x - center.x) / scale,
        y: (landmark.y - center.y) / scale,
      })),
    };
  });
}

function movementSummary(frames: BodyPoseFrame[]): {
  normalized: Array<{ t: number; points: Array<{ x: number; y: number }> }>;
  movements: NumericMap;
  segmentMovements: number[];
  segmentDurations: number[];
} {
  const normalized = normalizeAllLandmarks(frames);
  const movements = Object.fromEntries(
    frames[0]?.landmarks.map((_, index) => [nameForJoint(index), 0]) ?? [],
  );
  const segmentMovements: number[] = [];
  const segmentDurations: number[] = [];
  for (let frameIndex = 1; frameIndex < normalized.length; frameIndex += 1) {
    const previous = normalized[frameIndex - 1];
    const current = normalized[frameIndex];
    const duration = Math.max(current.t - previous.t, 0);
    if (!duration) continue;
    let total = 0;
    current.points.forEach((point, jointIndex) => {
      const prior = previous.points[jointIndex];
      const movement = prior ? Math.hypot(point.x - prior.x, point.y - prior.y) : 0;
      movements[nameForJoint(jointIndex)] = (movements[nameForJoint(jointIndex)] ?? 0) + movement;
      total += movement;
    });
    segmentMovements.push(total);
    segmentDurations.push(duration);
  }
  return { normalized, movements, segmentMovements, segmentDurations };
}

function buildJointDiagnostic(movements: NumericMap): JointMovementDiagnostic {
  const total = Object.values(movements).reduce((sum, value) => sum + value, 0);
  const ordered = Object.entries(movements).sort((left, right) => right[1] - left[1]);
  return {
    cumulativeMovement: movements,
    activeJointsByCurrentThreshold: ordered
      .filter(([, movement]) => movement >= 0.08)
      .map(([joint]) => joint),
    topMovingJoints: ordered.slice(0, 8).map(([joint, movement]) => ({
      joint,
      movement,
      contributionRatio: total > 0 ? movement / total : 0,
    })),
  };
}

function buildRegionDiagnostic(
  normalized: Array<{ t: number; points: Array<{ x: number; y: number }> }>,
): RegionActivityDiagnostic {
  const result = {} as RegionActivityDiagnostic;
  Object.entries(REGION_INDICES).forEach(([region, indices]) => {
    let cumulativeMovement = 0;
    let activeSegmentCount = 0;
    for (let frameIndex = 1; frameIndex < normalized.length; frameIndex += 1) {
      const previous = normalized[frameIndex - 1];
      const current = normalized[frameIndex];
      const movement = indices.reduce((sum, index) => {
        const prior = previous.points[index];
        const next = current.points[index];
        return sum + (prior && next ? Math.hypot(next.x - prior.x, next.y - prior.y) : 0);
      }, 0);
      cumulativeMovement += movement;
      if (movement >= BODY_REGION_ACTIVITY_THRESHOLD) activeSegmentCount += 1;
    }
    result[region as keyof RegionActivityDiagnostic] = {
      cumulativeMovement,
      activeSegmentCount,
      activityRatio: normalized.length > 1 ? activeSegmentCount / (normalized.length - 1) : 0,
    };
  });
  return result;
}

function buildDirectionDiagnostic(frames: BodyPoseFrame[]): DirectionDiagnostic {
  const normalized = normalizeMotionSequence(frames);
  if (normalized.length < 2) {
    return {
      relativeHorizontal: 0,
      relativeVertical: 0,
      centerHorizontal: 0,
      centerVertical: 0,
      selectedSource: "none",
    };
  }
  const first = normalized[0];
  const last = normalized.at(-1)!;
  const relativeHorizontal =
    (last.joints.leftWrist.x +
      last.joints.rightWrist.x -
      (first.joints.leftWrist.x + first.joints.rightWrist.x)) /
    2;
  const relativeVertical =
    (last.joints.leftWrist.y +
      last.joints.rightWrist.y -
      (first.joints.leftWrist.y + first.joints.rightWrist.y)) /
    2;
  const valid = frames.filter((frame) => frame.landmarks[11] && frame.landmarks[12]);
  const firstRaw = valid[0];
  const lastRaw = valid.at(-1);
  const scale = firstRaw
    ? Math.max(
        Math.hypot(
          firstRaw.landmarks[12].x - firstRaw.landmarks[11].x,
          firstRaw.landmarks[12].y - firstRaw.landmarks[11].y,
        ),
        0.001,
      )
    : 1;
  const firstCenter = firstRaw
    ? {
        x: (firstRaw.landmarks[11].x + firstRaw.landmarks[12].x) / 2,
        y: (firstRaw.landmarks[11].y + firstRaw.landmarks[12].y) / 2,
      }
    : { x: 0, y: 0 };
  const lastCenter = lastRaw
    ? {
        x: (lastRaw.landmarks[11].x + lastRaw.landmarks[12].x) / 2,
        y: (lastRaw.landmarks[11].y + lastRaw.landmarks[12].y) / 2,
      }
    : firstCenter;
  const centerHorizontal = (lastCenter.x - firstCenter.x) / scale;
  const centerVertical = (lastCenter.y - firstCenter.y) / scale;
  const jointMagnitude = Math.hypot(relativeHorizontal, relativeVertical);
  const centerMagnitude = Math.hypot(centerHorizontal, centerVertical);
  return {
    relativeHorizontal,
    relativeVertical,
    centerHorizontal,
    centerVertical,
    selectedSource: jointMagnitude >= 0.05 ? "joint" : centerMagnitude >= 0.05 ? "center" : "none",
  };
}

export function createRealCaptureDiagnostics(
  frames: BodyPoseFrame[],
  sampleAttempts = frames.length,
  invalidFrameCount = Math.max(sampleAttempts - frames.length, 0),
): MotionExperimentDiagnostic {
  const current = extractBodyMovementFeatures(frames);
  const coarse = buildSensoryBridgeInput(current);
  const extended = describeMotion(frames);
  const signature = createMotionSignature(frames);
  const metadataDuration = frames.length > 1 ? Math.max(frames.at(-1)!.t - frames[0].t, 0) : 0;
  const { normalized, movements, segmentMovements, segmentDurations } = movementSummary(frames);
  const speeds = segmentMovements.map(
    (movement, index) => movement / Math.max(segmentDurations[index], 1),
  );
  const fastSegments = speeds.filter((speed) => speed >= BODY_FAST_SPEED_THRESHOLD);
  const metadata: CaptureDiagnosticMetadata = {
    frameCount: frames.length,
    captureDurationMs: metadataDuration,
    approximateFrameRate:
      metadataDuration > 0 ? (frames.length - 1) / (metadataDuration / 1000) : 0,
    validFrameCount: frames.length,
    invalidFrameCount,
  };
  return {
    capture: metadata,
    current,
    coarse,
    extended,
    signature,
    jointMovement: buildJointDiagnostic(movements),
    regionActivity: buildRegionDiagnostic(normalized),
    speed: {
      meanSegmentSpeed: speeds.length
        ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
        : 0,
      medianSegmentSpeed: median(speeds),
      p90SegmentSpeed: percentile(speeds, 0.9),
      currentFastThreshold: BODY_FAST_SPEED_THRESHOLD,
      fastSegmentCount: fastSegments.length,
      fastDurationMs: segmentDurations
        .filter((_, index) => speeds[index] >= BODY_FAST_SPEED_THRESHOLD)
        .reduce((sum, duration) => sum + duration, 0),
    },
    directionDebug: buildDirectionDiagnostic(frames),
    summary: {
      coarse,
      current: {
        activeJointCount: current.activeJointCount,
        averageSpeed: current.averageSpeed,
        peakSpeed: current.peakSpeed,
        endingBehavior: current.endingBehavior,
      },
      extended: {
        trajectory: extended.trajectory,
        dynamics: extended.dynamics,
        ending: extended.ending,
      },
      signature: { version: signature.version, phases: signature.phases },
    },
  };
}
