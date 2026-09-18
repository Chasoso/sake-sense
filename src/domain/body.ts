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

export type BodyOrientation = {
  horizontal: { x: number; y: number };
  up: { x: number; y: number };
};

export type BodyMotionShape = {
  expansion: "expanding" | "contracting" | "unknown";
  dominantDirection: "upward" | "downward" | "lateral" | "unknown";
  repetition: "single" | "repeated" | "unknown";
  participation: "localized" | "broad" | "unknown";
};

export type BodyMovementFeatures = {
  /** Compact, locally-derived v2 representation; it contains no pose history. */
  representationVersion?: "v2";
  frameCount: number;
  captureDurationMs: number;
  activeDurationMs: number;
  totalMovement: number;
  averageSpeed: number;
  peakSpeed: number;
  hasSustainedFastMovement?: boolean;
  spread: number;
  hasMeaningfulMovement: boolean;
  activeJointCount: number;
  endingSpeedRatio: number;
  endingBehavior: "abrupt" | "gradual" | "continued" | "unknown";
  motionShape: BodyMotionShape;
  trajectory?: {
    pathShape: BodyMotionShapeAnalysis["trajectoryPathShape"];
    spatialExtent: BodyMotionShapeAnalysis["spatialExtent"];
    dominantJointIndices: number[];
    symmetry: BodyMotionShapeAnalysis["symmetry"];
  };
};

export type BodyMotionShapeAnalysis = {
  activeFrameCount: number;
  movingJoints: number[];
  representativeJoint: number | null;
  representativePath: number;
  centerPath: number;
  representativePathSource: "joint" | "center";
  representativeStart: { x: number; y: number } | null;
  representativeEnd: { x: number; y: number } | null;
  centerStart: { x: number; y: number } | null;
  centerEnd: { x: number; y: number } | null;
  radialStart: number;
  radialEnd: number;
  radialChange: number;
  expansionThreshold: number;
  expansion: BodyMotionShape["expansion"];
  directionDisplacement: { x: number; y: number };
  centerDisplacement: { x: number; y: number };
  relativeProjection: { horizontal: number; vertical: number } | null;
  centerProjection: { horizontal: number; vertical: number } | null;
  relativeMagnitude: number;
  centerMagnitude: number;
  selectedSource: "relative" | "center" | "none";
  selectedProjection: { horizontal: number; vertical: number } | null;
  dominantDirection: BodyMotionShape["dominantDirection"];
  repetitionAxis: "x" | "y" | null;
  xRange: number;
  yRange: number;
  reversalCount: number;
  repetitionThreshold: number;
  repetition: BodyMotionShape["repetition"];
  activeRegionCount: number;
  regionCount: number;
  broadParticipationRatio: number;
  participation: BodyMotionShape["participation"];
  /** v2 derives trajectories from visible upper-body joints only. */
  trajectoryJointIndices: number[];
  trajectoryPathShape: "linear" | "curved" | "oscillating" | "unknown";
  spatialExtent: "compact" | "extended" | "unknown";
  symmetry: "symmetric" | "asymmetric" | "unknown";
};

export type BodyMovementAnalysis = {
  features: BodyMovementFeatures;
  validFrameCount: number;
  normalizedFrameCount: number;
  stableScale: number;
  origin: { x: number; y: number };
  orientation: BodyOrientation | null;
  segmentMovements: number[];
  segmentSpeeds: number[];
  segmentDurations: number[];
  centerSegmentMovements: number[];
  jointMovement: number[];
  activeJointThreshold: number;
  activeJointIndices: number[];
  regionSegmentMovements: number[][];
  regionActiveSegmentCounts: number[];
  activeIndexes: number[];
  lastActiveIndex: number | null;
  finalSequence: number[];
  fastThreshold: number;
  minimumFastSegments: number;
  minimumFastDurationMs: number;
  fastSegmentCount: number;
  fastDurationMs: number;
  hasSustainedFastMovement: boolean;
  endingSpeedRatio: number;
  inactiveTailDuration: number;
  endingBehavior: BodyMovementFeatures["endingBehavior"];
  shape: BodyMotionShapeAnalysis;
  jointObservability: BodyJointObservability[];
  regionObservability: BodyRegionObservability[];
  observabilityExperiment: BodyObservabilityExperiment;
  speedObservability: BodySpeedObservability;
};

export type BodyJointObservability = {
  sampleCount: number;
  visibleSampleCount: number;
  visibilityRatio: number;
  meanVisibility: number;
  medianVisibility: number;
  minimumVisibility: number;
  p10Visibility: number;
  currentMovement: number;
  currentlyActive: boolean;
  observable: boolean;
  visibleDurationMs: number;
  movementPerVisibleSecond: number;
  movementPerVisibleSample: number;
};

export type BodyRegionObservability = {
  jointIndices: number[];
  observableJointIndices: number[];
  observableJointCount: number;
  totalJointCount: number;
  observableRatio: number;
  currentCumulativeMovement: number;
  currentActiveSegmentCount: number;
  currentActivityRatio: number;
  currentlyCountsAsActiveRegion: boolean;
  observableOnlyCumulativeMovement: number;
  observableOnlyActiveSegmentCount: number;
  observableOnlyActivityRatio: number;
  observableOnlyMeetsMeaningfulActiveCriteria: boolean;
};

export type BodyObservabilityExperiment = {
  observableJointCount: number;
  observableActiveJointCount: number;
  observableRegions: number[];
  activeObservableRegions: number[];
  participationIfUnobservedIgnored: BodyMotionShape["participation"];
};

export type BodySpeedObservability = {
  currentSegmentSpeeds: number[];
  observableOnlySegmentSpeeds: number[];
  upperBodyOnlySegmentSpeeds: number[];
  currentMedian: number;
  observableOnlyMedian: number;
  upperBodyOnlyMedian: number;
};

export function humanizeBodyFeatures(features: BodyMovementFeatures): string[] {
  if (!features.hasMeaningfulMovement) return ["はっきりした動きを十分に捉えられませんでした"];
  const summaries = [
    features.activeDurationMs <= BODY_SHORT_DURATION_THRESHOLD_MS
      ? "短い動きでした"
      : "長く続く動きでした",
    features.spread >= BODY_BROAD_MOVEMENT_THRESHOLD
      ? "大きな範囲を動きました"
      : "まとまった範囲で動きました",
  ];
  if (features.hasSustainedFastMovement === true) summaries.push("速い動きが含まれていました");
  if (features.endingBehavior === "abrupt") summaries.push("最後にすっと止まりました");
  if (features.endingBehavior === "gradual") summaries.push("最後はゆっくり収まりました");
  if (features.endingBehavior === "continued") summaries.push("最後まで動きが続いていました");
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
export const BODY_MINIMUM_INACTIVE_TAIL_DURATION_MS = 120;
export const BODY_FAST_SPEED_THRESHOLD = 0.01;
export const BODY_MINIMUM_FAST_SEGMENTS = 3;
export const BODY_MINIMUM_FAST_DURATION_MS = 250;
export const BODY_REGION_ACTIVITY_THRESHOLD = 0.03;
export const BODY_MINIMUM_REGION_ACTIVE_SEGMENTS = 2;
export const BODY_MINIMUM_MEANINGFUL_ACTIVE_SEGMENTS = 2;
export const BODY_MEANINGFUL_SPREAD_THRESHOLD = 0.08;
export const BODY_MOTION_SHAPE_CHANGE_THRESHOLD = 0.15;
export const BODY_MOTION_DIRECTION_THRESHOLD = 0.2;
export const BODY_MOTION_DIRECTION_DOMINANCE_RATIO = 1.25;
export const BODY_MOTION_REVERSAL_THRESHOLD = 0.08;
export const BODY_BROAD_PARTICIPATION_RATIO = 0.5;
export const BODY_GLOBAL_MOVEMENT_ACTIVITY_THRESHOLD = 0.04;
export const BODY_JOINT_JITTER_THRESHOLD = 0.015;
export const BODY_ACTIVE_JOINT_THRESHOLD = 0.08;
/** v2 production policy: only landmarks visible in both segment endpoints are observable. */
export const BODY_OBSERVABLE_VISIBILITY_THRESHOLD = 0.35;
export const BODY_OBSERVABLE_MIN_VISIBLE_RATIO = 0.35;
/** Backwards-compatible names retained for development diagnostics. */
export const BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD = BODY_OBSERVABLE_VISIBILITY_THRESHOLD;
export const BODY_DIAGNOSTIC_MIN_VISIBLE_RATIO = BODY_OBSERVABLE_MIN_VISIBLE_RATIO;

function finite(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
}

function distance(from: BodyLandmark, to: BodyLandmark): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function normalizedVector(vector: { x: number; y: number }): { x: number; y: number } | null {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : null;
}

function shoulderGeometry(frame: BodyPoseFrame): {
  center: { x: number; y: number };
  scale: number;
} | null {
  const left = frame.landmarks[LEFT_SHOULDER];
  const right = frame.landmarks[RIGHT_SHOULDER];
  if (
    !left ||
    !right ||
    finite(left.visibility ?? 1) < BODY_OBSERVABLE_VISIBILITY_THRESHOLD ||
    finite(right.visibility ?? 1) < BODY_OBSERVABLE_VISIBILITY_THRESHOLD
  )
    return null;
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

function suppressJointJitter(frames: NormalizedBodyPoseFrame[]): NormalizedBodyPoseFrame[] {
  if (!frames.length) return [];
  const filtered = [frames[0]];
  for (let frameIndex = 1; frameIndex < frames.length; frameIndex += 1) {
    const previous = filtered[frameIndex - 1];
    const current = frames[frameIndex];
    filtered.push({
      ...current,
      landmarks: current.landmarks.map((landmark, jointIndex) => {
        const previousLandmark = previous.landmarks[jointIndex];
        if (!previousLandmark) return landmark;
        return distance(previousLandmark, landmark) < BODY_JOINT_JITTER_THRESHOLD
          ? previousLandmark
          : landmark;
      }),
    });
  }
  return filtered;
}

function getBodyOrientation(frames: BodyPoseFrame[]): BodyOrientation | null {
  const shoulderAngles: number[] = [];
  const torsoDownVectors: Array<{ x: number; y: number }> = [];
  frames.forEach((frame) => {
    const leftShoulder = frame.landmarks[LEFT_SHOULDER];
    const rightShoulder = frame.landmarks[RIGHT_SHOULDER];
    const leftHip = frame.landmarks[23];
    const rightHip = frame.landmarks[24];
    if (!leftShoulder || !rightShoulder) return;
    if (
      (leftShoulder.visibility ?? 1) < BODY_OBSERVABLE_VISIBILITY_THRESHOLD ||
      (rightShoulder.visibility ?? 1) < BODY_OBSERVABLE_VISIBILITY_THRESHOLD
    )
      return;
    const shoulder = normalizedVector({
      x: rightShoulder.x - leftShoulder.x,
      y: rightShoulder.y - leftShoulder.y,
    });
    if (!shoulder) return;
    shoulderAngles.push(Math.atan2(shoulder.y, shoulder.x));
    if (
      leftHip &&
      rightHip &&
      (leftHip.visibility ?? 1) >= BODY_OBSERVABLE_VISIBILITY_THRESHOLD &&
      (rightHip.visibility ?? 1) >= BODY_OBSERVABLE_VISIBILITY_THRESHOLD
    ) {
      const torsoDown = normalizedVector({
        x: (leftHip.x + rightHip.x) / 2 - (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftHip.y + rightHip.y) / 2 - (leftShoulder.y + rightShoulder.y) / 2,
      });
      if (torsoDown) torsoDownVectors.push(torsoDown);
    }
  });
  if (!shoulderAngles.length) return null;
  const horizontal = normalizedVector({
    x: median(shoulderAngles.map((angle) => Math.cos(angle))),
    y: median(shoulderAngles.map((angle) => Math.sin(angle))),
  });
  if (!horizontal) return null;
  const torsoDown = torsoDownVectors.length
    ? normalizedVector({
        x: median(torsoDownVectors.map((vector) => vector.x)),
        y: median(torsoDownVectors.map((vector) => vector.y)),
      })
    : null;
  const perpendicular = { x: -horizontal.y, y: horizontal.x };
  // Hips are optional. When absent, retain the camera-up perpendicular so wrist
  // trajectories still have a stable upper-body direction reference.
  const down = torsoDown
    ? dot(perpendicular, torsoDown) >= 0
      ? perpendicular
      : { x: -perpendicular.x, y: -perpendicular.y }
    : perpendicular.y >= 0
      ? perpendicular
      : { x: -perpendicular.x, y: -perpendicular.y };
  return { horizontal, up: { x: -down.x, y: -down.y } };
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

function buildObservabilityAnalysis(
  normalized: NormalizedBodyPoseFrame[],
  jointMovement: number[],
  regionSegmentMovements: number[][],
  regionActiveSegmentCounts: number[],
  segmentSpeeds: number[],
): Pick<
  BodyMovementAnalysis,
  "jointObservability" | "regionObservability" | "observabilityExperiment" | "speedObservability"
> {
  const sampleCount = normalized.length;
  const jointCount = Math.max(
    normalized.reduce((maximum, frame) => Math.max(maximum, frame.landmarks.length), 0),
    jointMovement.length,
  );
  const jointObservability: BodyJointObservability[] = Array.from(
    { length: jointCount },
    (_, jointIndex) => {
      const visibilities = normalized.map((frame) => frame.landmarks[jointIndex]?.visibility ?? 0);
      const visibleSampleCount = visibilities.filter(
        (visibility) => visibility >= BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD,
      ).length;
      let visibleDurationMs = 0;
      for (let index = 1; index < normalized.length; index += 1) {
        const previous = normalized[index - 1].landmarks[jointIndex];
        const current = normalized[index].landmarks[jointIndex];
        if (
          previous &&
          current &&
          previous.visibility! >= BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD &&
          current.visibility! >= BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD
        ) {
          visibleDurationMs += Math.max(normalized[index].t - normalized[index - 1].t, 0);
        }
      }
      const movement = jointMovement[jointIndex] ?? 0;
      const visibilityRatio = sampleCount ? visibleSampleCount / sampleCount : 0;
      return {
        sampleCount,
        visibleSampleCount,
        visibilityRatio,
        meanVisibility: visibilities.length
          ? visibilities.reduce((sum, value) => sum + value, 0) / visibilities.length
          : 0,
        medianVisibility: median(visibilities),
        minimumVisibility: visibilities.length ? Math.min(...visibilities) : 0,
        p10Visibility: percentile(visibilities, 0.1),
        currentMovement: movement,
        currentlyActive: movement >= BODY_ACTIVE_JOINT_THRESHOLD,
        observable: visibilityRatio >= BODY_DIAGNOSTIC_MIN_VISIBLE_RATIO,
        visibleDurationMs,
        movementPerVisibleSecond: visibleDurationMs > 0 ? movement / (visibleDurationMs / 1000) : 0,
        movementPerVisibleSample: visibleSampleCount ? movement / visibleSampleCount : 0,
      };
    },
  );

  const regionObservability: BodyRegionObservability[] = MOTION_REGIONS.map(
    (jointIndices, regionIndex) => {
      const observableJointIndices = jointIndices.filter(
        (jointIndex) => jointObservability[jointIndex]?.observable,
      );
      const movements = regionSegmentMovements[regionIndex] ?? [];
      const activeSegmentCount = regionActiveSegmentCounts[regionIndex] ?? 0;
      const observableOnlyMovements = normalized.slice(1).map((frame, segmentIndex) => {
        const previous = normalized[segmentIndex];
        return jointIndices.reduce((sum, jointIndex) => {
          const before = previous.landmarks[jointIndex];
          const after = frame.landmarks[jointIndex];
          if (
            !before ||
            !after ||
            before.visibility! < BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD ||
            after.visibility! < BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD
          ) {
            return sum;
          }
          return sum + distance(before, after);
        }, 0);
      });
      const observableOnlyActiveSegmentCount = observableOnlyMovements.filter(
        (movement) => movement >= BODY_REGION_ACTIVITY_THRESHOLD,
      ).length;
      return {
        jointIndices: [...jointIndices],
        observableJointIndices,
        observableJointCount: observableJointIndices.length,
        totalJointCount: jointIndices.length,
        observableRatio: jointIndices.length
          ? observableJointIndices.length / jointIndices.length
          : 0,
        currentCumulativeMovement: movements.reduce((sum, movement) => sum + movement, 0),
        currentActiveSegmentCount: activeSegmentCount,
        currentActivityRatio: movements.length ? activeSegmentCount / movements.length : 0,
        currentlyCountsAsActiveRegion: activeSegmentCount >= BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
        observableOnlyCumulativeMovement: observableOnlyMovements.reduce(
          (sum, movement) => sum + movement,
          0,
        ),
        observableOnlyActiveSegmentCount,
        observableOnlyActivityRatio: observableOnlyMovements.length
          ? observableOnlyActiveSegmentCount / observableOnlyMovements.length
          : 0,
        observableOnlyMeetsMeaningfulActiveCriteria:
          observableOnlyActiveSegmentCount >= BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
      };
    },
  );
  const observableCoreJointIndices = CORE_MOVEMENT_JOINTS.filter(
    (jointIndex) => jointObservability[jointIndex]?.observable,
  );
  const observableRegions = regionObservability
    .map((region, index) => (region.observableJointCount > 0 ? index : -1))
    .filter((index) => index >= 0);
  const activeObservableRegions = observableRegions.filter(
    (index) => regionObservability[index].observableOnlyMeetsMeaningfulActiveCriteria,
  );
  const participationIfUnobservedIgnored: BodyMotionShape["participation"] =
    observableRegions.length === 0
      ? "unknown"
      : activeObservableRegions.length / observableRegions.length >= BODY_BROAD_PARTICIPATION_RATIO
        ? "broad"
        : "localized";

  const observableOnlySegmentSpeeds: number[] = [];
  const upperBodyOnlySegmentSpeeds: number[] = [];
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const duration = Math.max(current.t - previous.t, 0);
    if (!duration) continue;
    const segmentSpeed = (indices: number[]) =>
      indices.reduce((sum, jointIndex) => {
        const before = previous.landmarks[jointIndex];
        const after = current.landmarks[jointIndex];
        if (
          !before ||
          !after ||
          before.visibility! < BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD ||
          after.visibility! < BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD
        )
          return sum;
        return sum + distance(before, after);
      }, 0) / duration;
    observableOnlySegmentSpeeds.push(segmentSpeed(observableCoreJointIndices));
    upperBodyOnlySegmentSpeeds.push(segmentSpeed(UPPER_BODY_JOINTS));
  }
  return {
    jointObservability,
    regionObservability,
    observabilityExperiment: {
      observableJointCount: observableCoreJointIndices.length,
      observableActiveJointCount: observableCoreJointIndices.filter(
        (jointIndex) => jointObservability[jointIndex]?.currentlyActive,
      ).length,
      observableRegions,
      activeObservableRegions,
      participationIfUnobservedIgnored,
    },
    speedObservability: {
      currentSegmentSpeeds: [...segmentSpeeds],
      observableOnlySegmentSpeeds,
      upperBodyOnlySegmentSpeeds,
      currentMedian: median(segmentSpeeds),
      observableOnlyMedian: median(observableOnlySegmentSpeeds),
      upperBodyOnlyMedian: median(upperBodyOnlySegmentSpeeds),
    },
  };
}

/**
 * Production Body representation v2 deliberately observes a small upper-body
 * subset. Pose guesses for face and lower-body landmarks must not become
 * movement evidence when they are off screen or low visibility.
 */
const CORE_MOVEMENT_JOINTS = [11, 12, 13, 14, 15, 16] as const;
const LEFT_ARM_JOINTS = [13, 15] as const;
const RIGHT_ARM_JOINTS = [14, 16] as const;
const WRIST_JOINTS = [15, 16] as const;
const ARM_JOINTS = [...LEFT_ARM_JOINTS, ...RIGHT_ARM_JOINTS];
const MOTION_JOINTS = CORE_MOVEMENT_JOINTS;
const MOTION_REGIONS = [
  [...LEFT_ARM_JOINTS],
  [...RIGHT_ARM_JOINTS],
  [11, 12, 23, 24],
  [25, 26, 27, 28],
];
const UPPER_BODY_JOINTS = [...CORE_MOVEMENT_JOINTS];

function isObservableLandmark(landmark: BodyLandmark | undefined): landmark is BodyLandmark {
  return Boolean(
    landmark && finite(landmark.visibility ?? 1) >= BODY_OBSERVABLE_VISIBILITY_THRESHOLD,
  );
}

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
    .filter(isObservableLandmark)
    .map((landmark) => Math.hypot(landmark.x, landmark.y));
  return distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : 0;
}

function extractMotionShape(
  normalized: NormalizedBodyPoseFrame[],
  segmentMovements: number[],
  jointMovement: number[],
  regionActiveSegmentCounts: number[],
  orientation: BodyOrientation | null,
): { shape: BodyMotionShape; analysis: BodyMotionShapeAnalysis } {
  const emptyAnalysis = (): BodyMotionShapeAnalysis => ({
    activeFrameCount: 0,
    movingJoints: [],
    representativeJoint: null,
    representativePath: 0,
    centerPath: 0,
    representativePathSource: "center",
    representativeStart: null,
    representativeEnd: null,
    centerStart: null,
    centerEnd: null,
    radialStart: 0,
    radialEnd: 0,
    radialChange: 0,
    expansionThreshold: BODY_MOTION_SHAPE_CHANGE_THRESHOLD,
    expansion: "unknown",
    directionDisplacement: { x: 0, y: 0 },
    centerDisplacement: { x: 0, y: 0 },
    relativeProjection: null,
    centerProjection: null,
    relativeMagnitude: 0,
    centerMagnitude: 0,
    selectedSource: "none",
    selectedProjection: null,
    dominantDirection: "unknown",
    repetitionAxis: null,
    xRange: 0,
    yRange: 0,
    reversalCount: 0,
    repetitionThreshold: BODY_MOTION_REVERSAL_THRESHOLD,
    repetition: "unknown",
    activeRegionCount: 0,
    regionCount: MOTION_REGIONS.length,
    broadParticipationRatio: BODY_BROAD_PARTICIPATION_RATIO,
    participation: "unknown",
    trajectoryJointIndices: [],
    trajectoryPathShape: "unknown",
    spatialExtent: "unknown",
    symmetry: "unknown",
  });
  const activeFrameIndexes = new Set<number>();
  segmentMovements.forEach((movement, index) => {
    if (movement >= BODY_MOVEMENT_ACTIVITY_THRESHOLD) {
      activeFrameIndexes.add(index);
      activeFrameIndexes.add(index + 1);
    }
  });
  const activeFrames = [...activeFrameIndexes].sort((left, right) => left - right);
  if (activeFrames.length < 2) {
    return { shape: unknownMotionShape(), analysis: emptyAnalysis() };
  }

  const firstFrame = normalized[activeFrames[0]];
  const lastFrame = normalized[activeFrames.at(-1)!];
  const radialChange = meanRadialDistance(lastFrame) - meanRadialDistance(firstFrame);
  const expansion: BodyMotionShape["expansion"] =
    radialChange >= BODY_MOTION_SHAPE_CHANGE_THRESHOLD
      ? "expanding"
      : radialChange <= -BODY_MOTION_SHAPE_CHANGE_THRESHOLD
        ? "contracting"
        : "unknown";

  const movingJoints = MOTION_JOINTS.filter(
    (index) =>
      (jointMovement[index] ?? 0) >= BODY_MOTION_REVERSAL_THRESHOLD &&
      isObservableLandmark(firstFrame.landmarks[index]) &&
      isObservableLandmark(lastFrame.landmarks[index]),
  );
  const directionDisplacement = movingJoints.reduce(
    (sum, index) => {
      const start = firstFrame.landmarks[index];
      const end = lastFrame.landmarks[index];
      if (!isObservableLandmark(start) || !isObservableLandmark(end)) return sum;
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
  const relativeProjection = orientation
    ? {
        horizontal: dot(directionDisplacement, orientation.horizontal),
        vertical: dot(directionDisplacement, orientation.up),
      }
    : null;
  const centerProjection = null;
  const relativeMagnitude = relativeProjection
    ? Math.hypot(relativeProjection.horizontal, relativeProjection.vertical)
    : 0;
  const centerMagnitude = 0;
  const selectedProjection =
    !orientation || relativeMagnitude < BODY_MOTION_DIRECTION_THRESHOLD ? null : relativeProjection;
  const horizontalMagnitude = selectedProjection ? Math.abs(selectedProjection.horizontal) : 0;
  const verticalMagnitude = selectedProjection ? Math.abs(selectedProjection.vertical) : 0;
  const dominantDirection: BodyMotionShape["dominantDirection"] =
    !selectedProjection ||
    Math.max(horizontalMagnitude, verticalMagnitude) < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : horizontalMagnitude >= verticalMagnitude * BODY_MOTION_DIRECTION_DOMINANCE_RATIO
        ? "lateral"
        : verticalMagnitude >= horizontalMagnitude * BODY_MOTION_DIRECTION_DOMINANCE_RATIO
          ? selectedProjection.vertical > 0
            ? "upward"
            : "downward"
          : "unknown";

  const trajectoryCandidates = [
    ...WRIST_JOINTS.filter((index) => movingJoints.includes(index)),
    ...ARM_JOINTS.filter(
      (index) =>
        movingJoints.includes(index) && !(WRIST_JOINTS as readonly number[]).includes(index),
    ),
  ];
  let representativeJoint = trajectoryCandidates[0];
  let representativePath = 0;
  trajectoryCandidates.forEach((jointIndex) => {
    let path = 0;
    for (let index = 1; index < activeFrames.length; index += 1) {
      const previous = normalized[activeFrames[index - 1]].landmarks[jointIndex];
      const current = normalized[activeFrames[index]].landmarks[jointIndex];
      if (isObservableLandmark(previous) && isObservableLandmark(current)) {
        path += distance(previous, current);
      }
    }
    if (path > representativePath) {
      representativeJoint = jointIndex;
      representativePath = path;
    }
  });
  const centerTrajectory = activeFrames.map((frameIndex) => normalized[frameIndex].bodyCenter);
  const trajectory =
    representativeJoint === undefined
      ? []
      : activeFrames
          .map((frameIndex) => normalized[frameIndex].landmarks[representativeJoint])
          .filter(isObservableLandmark);
  const centerPath = centerTrajectory.reduce(
    (path, point, index) =>
      index === 0 ? path : path + distance(centerTrajectory[index - 1], point),
    0,
  );
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
  const repetition: BodyMotionShape["repetition"] =
    representativePath < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : reversals >= 2
        ? "repeated"
        : "single";

  const trajectoryPathShape: BodyMotionShapeAnalysis["trajectoryPathShape"] =
    representativePath < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : repetition === "repeated"
        ? "oscillating"
        : representativePath > Math.hypot(xRange, yRange) * 1.3
          ? "curved"
          : "linear";
  const spatialExtent: BodyMotionShapeAnalysis["spatialExtent"] =
    representativePath < BODY_MOTION_DIRECTION_THRESHOLD
      ? "unknown"
      : Math.max(xRange, yRange) >= BODY_BROAD_MOVEMENT_THRESHOLD
        ? "extended"
        : "compact";
  const leftContribution = LEFT_ARM_JOINTS.reduce(
    (sum, index) => sum + (jointMovement[index] ?? 0),
    0,
  );
  const rightContribution = RIGHT_ARM_JOINTS.reduce(
    (sum, index) => sum + (jointMovement[index] ?? 0),
    0,
  );
  const symmetry: BodyMotionShapeAnalysis["symmetry"] =
    leftContribution < BODY_MOTION_REVERSAL_THRESHOLD &&
    rightContribution < BODY_MOTION_REVERSAL_THRESHOLD
      ? "unknown"
      : Math.min(leftContribution, rightContribution) /
            Math.max(leftContribution, rightContribution) >=
          0.6
        ? "symmetric"
        : "asymmetric";

  const activeRegions = regionActiveSegmentCounts.filter(
    (count) => count >= BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
  ).length;
  // Broad in v2 means meaningful contribution from both observable arms, not
  // merely activity in arbitrary full-body landmark regions.
  const participation: BodyMotionShape["participation"] =
    leftContribution < BODY_ACTIVE_JOINT_THRESHOLD &&
    rightContribution < BODY_ACTIVE_JOINT_THRESHOLD
      ? "unknown"
      : leftContribution >= BODY_ACTIVE_JOINT_THRESHOLD &&
          rightContribution >= BODY_ACTIVE_JOINT_THRESHOLD
        ? "broad"
        : "localized";

  const representativeStart = trajectory[0] ?? null;
  const representativeEnd = trajectory.at(-1) ?? null;
  const centerStartPoint = centerTrajectory[0] ?? null;
  const centerEndPoint = centerTrajectory.at(-1) ?? null;
  const analysis: BodyMotionShapeAnalysis = {
    activeFrameCount: activeFrames.length,
    movingJoints,
    representativeJoint: representativeJoint ?? null,
    representativePath,
    centerPath,
    representativePathSource: representativeJoint === undefined ? "center" : "joint",
    representativeStart,
    representativeEnd,
    centerStart: centerStartPoint,
    centerEnd: centerEndPoint,
    radialStart: meanRadialDistance(firstFrame),
    radialEnd: meanRadialDistance(lastFrame),
    radialChange,
    expansionThreshold: BODY_MOTION_SHAPE_CHANGE_THRESHOLD,
    expansion,
    directionDisplacement,
    centerDisplacement,
    relativeProjection,
    centerProjection,
    relativeMagnitude,
    centerMagnitude,
    selectedSource: selectedProjection
      ? selectedProjection === relativeProjection
        ? "relative"
        : "center"
      : "none",
    selectedProjection,
    dominantDirection,
    repetitionAxis: trajectory.length ? axis : null,
    xRange,
    yRange,
    reversalCount: reversals,
    repetitionThreshold: BODY_MOTION_REVERSAL_THRESHOLD,
    repetition,
    activeRegionCount: activeRegions,
    regionCount: MOTION_REGIONS.length,
    broadParticipationRatio: BODY_BROAD_PARTICIPATION_RATIO,
    participation,
    trajectoryJointIndices: trajectoryCandidates,
    trajectoryPathShape,
    spatialExtent,
    symmetry,
  };
  return {
    shape: { expansion, dominantDirection, repetition, participation },
    analysis,
  };
}

export function analyzeBodyMovement(frames: BodyPoseFrame[]): BodyMovementAnalysis {
  const validFrames = frames.filter((frame) => shoulderGeometry(frame) !== null);
  const orientation = getBodyOrientation(validFrames);
  const geometries = validFrames.map((frame) => shoulderGeometry(frame)!);
  const stableScale = median(geometries.map(({ scale }) => scale)) || 1;
  const origin = geometries[0]?.center ?? { x: 0, y: 0 };
  const normalized = suppressJointJitter(
    validFrames
      .map((frame) => normalizeFrame(frame, stableScale, origin))
      .filter((frame): frame is NormalizedBodyPoseFrame => frame !== null),
  );
  if (normalized.length < 2) {
    const features: BodyMovementFeatures = {
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
      representationVersion: "v2",
      trajectory: {
        pathShape: "unknown",
        spatialExtent: "unknown",
        dominantJointIndices: [],
        symmetry: "unknown",
      },
    };
    return {
      features,
      validFrameCount: validFrames.length,
      normalizedFrameCount: normalized.length,
      stableScale,
      origin,
      orientation,
      segmentMovements: [],
      segmentSpeeds: [],
      segmentDurations: [],
      centerSegmentMovements: [],
      jointMovement: [],
      activeJointThreshold: BODY_ACTIVE_JOINT_THRESHOLD,
      activeJointIndices: [],
      regionSegmentMovements: MOTION_REGIONS.map(() => []),
      regionActiveSegmentCounts: [],
      activeIndexes: [],
      lastActiveIndex: null,
      finalSequence: [],
      fastThreshold: BODY_FAST_SPEED_THRESHOLD,
      minimumFastSegments: BODY_MINIMUM_FAST_SEGMENTS,
      minimumFastDurationMs: BODY_MINIMUM_FAST_DURATION_MS,
      fastSegmentCount: 0,
      fastDurationMs: 0,
      hasSustainedFastMovement: false,
      endingSpeedRatio: 0,
      inactiveTailDuration: 0,
      endingBehavior: "unknown",
      shape: {
        activeFrameCount: 0,
        movingJoints: [],
        representativeJoint: null,
        representativePath: 0,
        centerPath: 0,
        representativePathSource: "center",
        representativeStart: null,
        representativeEnd: null,
        centerStart: null,
        centerEnd: null,
        radialStart: 0,
        radialEnd: 0,
        radialChange: 0,
        expansionThreshold: BODY_MOTION_SHAPE_CHANGE_THRESHOLD,
        expansion: "unknown",
        directionDisplacement: { x: 0, y: 0 },
        centerDisplacement: { x: 0, y: 0 },
        relativeProjection: null,
        centerProjection: null,
        relativeMagnitude: 0,
        centerMagnitude: 0,
        selectedSource: "none",
        selectedProjection: null,
        dominantDirection: "unknown",
        repetitionAxis: null,
        xRange: 0,
        yRange: 0,
        reversalCount: 0,
        repetitionThreshold: BODY_MOTION_REVERSAL_THRESHOLD,
        repetition: "unknown",
        activeRegionCount: 0,
        regionCount: MOTION_REGIONS.length,
        broadParticipationRatio: BODY_BROAD_PARTICIPATION_RATIO,
        participation: "unknown",
        trajectoryJointIndices: [],
        trajectoryPathShape: "unknown",
        spatialExtent: "unknown",
        symmetry: "unknown",
      },
      ...buildObservabilityAnalysis(normalized, [], [], [], []),
    };
  }

  const segmentSpeeds: number[] = [];
  const segmentMovements: number[] = [];
  const segmentDurations: number[] = [];
  const jointMovement = new Array(normalized[0].landmarks.length).fill(0) as number[];
  const regionSegmentMovements = MOTION_REGIONS.map(() => [] as number[]);
  const centerSegmentMovements: number[] = [];
  const startingLandmarks = normalized[0].landmarks;
  let movementSpread = 0;
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    const current = normalized[index];
    const elapsed = current.t - previous.t;
    if (elapsed <= 0) continue;
    const observableJointMovements: number[] = [];
    const regionMovements = MOTION_REGIONS.map(() => 0);
    CORE_MOVEMENT_JOINTS.forEach((jointIndex) => {
      const landmark = current.landmarks[jointIndex];
      const previousLandmark = previous.landmarks[jointIndex];
      if (!isObservableLandmark(previousLandmark) || !isObservableLandmark(landmark)) return;
      const jointDistance = distance(previousLandmark, landmark);
      observableJointMovements.push(jointDistance);
      jointMovement[jointIndex] += jointDistance;
      MOTION_REGIONS.forEach((region, regionIndex) => {
        if ((region as number[]).includes(jointIndex))
          regionMovements[regionIndex] += jointDistance;
      });
      const startingLandmark = startingLandmarks[jointIndex];
      if (isObservableLandmark(startingLandmark)) {
        movementSpread = Math.max(movementSpread, distance(startingLandmark, landmark));
      }
    });
    // A representative joint distance prevents the number of available Pose
    // landmarks from inflating motion or speed. A single visible wrist remains
    // sufficient evidence; off-screen joints contribute nothing.
    const movement = observableJointMovements.length ? Math.max(...observableJointMovements) : 0;
    const centerMovement = distance(previous.bodyCenter, current.bodyCenter);
    centerSegmentMovements.push(centerMovement);
    segmentMovements.push(movement);
    segmentSpeeds.push(movement / elapsed);
    segmentDurations.push(elapsed);
    regionMovements.forEach((regionMovement, regionIndex) => {
      regionSegmentMovements[regionIndex].push(regionMovement);
    });
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
  const regionActiveSegmentCounts = regionSegmentMovements.map(
    (regionMovements) =>
      regionMovements.filter((movement) => movement >= BODY_REGION_ACTIVITY_THRESHOLD).length,
  );
  const meaningfulRegionCount = regionActiveSegmentCounts.filter(
    (count) => count >= BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
  ).length;
  const hasMeaningfulMovement =
    activeDurationMs > 0 &&
    (meaningfulRegionCount > 0 || movementSpread >= BODY_MEANINGFUL_SPREAD_THRESHOLD);
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
  const inactiveTailStart =
    lastActiveIndex === undefined ? segmentMovements.length : lastActiveIndex + 1;
  const inactiveTailDuration = segmentDurations
    .slice(inactiveTailStart)
    .reduce((duration, segmentDuration) => duration + segmentDuration, 0);
  const observedInactiveTail = inactiveTailDuration >= BODY_MINIMUM_INACTIVE_TAIL_DURATION_MS;
  const slowdownWindow = activeSpeeds.slice(Math.max(activeSpeeds.length - 3, 0));
  const hasProgressiveSlowdown =
    slowdownWindow.length >= 2 &&
    slowdownWindow.at(-1)! < slowdownWindow[0] &&
    slowdownWindow.some((speed, index) => index > 0 && speed < slowdownWindow[index - 1]);
  const endingBehavior =
    activeSpeeds.length < 3 || representative === 0
      ? "unknown"
      : !observedInactiveTail
        ? "continued"
        : endingSpeedRatio >= BODY_ABRUPT_ENDING_RATIO
          ? "abrupt"
          : hasProgressiveSlowdown
            ? "gradual"
            : "unknown";

  let currentFastSegments = 0;
  let currentFastDuration = 0;
  let longestFastSegments = 0;
  let longestFastDuration = 0;
  segmentSpeeds.forEach((speed, index) => {
    if (
      speed >= BODY_FAST_SPEED_THRESHOLD &&
      segmentMovements[index] >= BODY_MOVEMENT_ACTIVITY_THRESHOLD
    ) {
      currentFastSegments += 1;
      currentFastDuration += segmentDurations[index];
      longestFastSegments = Math.max(longestFastSegments, currentFastSegments);
      longestFastDuration = Math.max(longestFastDuration, currentFastDuration);
    } else {
      currentFastSegments = 0;
      currentFastDuration = 0;
    }
  });
  const hasSustainedFastMovement =
    longestFastSegments >= BODY_MINIMUM_FAST_SEGMENTS &&
    longestFastDuration >= BODY_MINIMUM_FAST_DURATION_MS;

  const activeJointIndices = CORE_MOVEMENT_JOINTS.filter(
    (index) => (jointMovement[index] ?? 0) >= BODY_ACTIVE_JOINT_THRESHOLD,
  );
  const shapeResult = hasMeaningfulMovement
    ? extractMotionShape(
        normalized,
        segmentMovements,
        jointMovement,
        regionActiveSegmentCounts,
        orientation,
      )
    : {
        shape: unknownMotionShape(),
        analysis: {
          activeFrameCount: 0,
          movingJoints: [],
          representativeJoint: null,
          representativePath: 0,
          centerPath: 0,
          representativePathSource: "center" as const,
          representativeStart: null,
          representativeEnd: null,
          centerStart: null,
          centerEnd: null,
          radialStart: 0,
          radialEnd: 0,
          radialChange: 0,
          expansionThreshold: BODY_MOTION_SHAPE_CHANGE_THRESHOLD,
          expansion: "unknown" as const,
          directionDisplacement: { x: 0, y: 0 },
          centerDisplacement: { x: 0, y: 0 },
          relativeProjection: null,
          centerProjection: null,
          relativeMagnitude: 0,
          centerMagnitude: 0,
          selectedSource: "none" as const,
          selectedProjection: null,
          dominantDirection: "unknown" as const,
          repetitionAxis: null,
          xRange: 0,
          yRange: 0,
          reversalCount: 0,
          repetitionThreshold: BODY_MOTION_REVERSAL_THRESHOLD,
          repetition: "unknown" as const,
          activeRegionCount: 0,
          regionCount: MOTION_REGIONS.length,
          broadParticipationRatio: BODY_BROAD_PARTICIPATION_RATIO,
          participation: "unknown" as const,
          trajectoryJointIndices: [],
          trajectoryPathShape: "unknown" as const,
          spatialExtent: "unknown" as const,
          symmetry: "unknown" as const,
        },
      };
  const features: BodyMovementFeatures = {
    frameCount: normalized.length,
    totalMovement: segmentMovements.reduce((sum, movement) => sum + movement, 0),
    averageSpeed: activeDurationMs > 0 ? activeMovement / activeDurationMs : 0,
    peakSpeed: segmentSpeeds.length ? Math.max(...segmentSpeeds) : 0,
    hasSustainedFastMovement,
    activeJointCount: activeJointIndices.length,
    endingSpeedRatio,
    endingBehavior,
    captureDurationMs,
    activeDurationMs,
    spread: movementSpread,
    hasMeaningfulMovement,
    motionShape: shapeResult.shape,
    representationVersion: "v2",
    trajectory: {
      pathShape: shapeResult.analysis.trajectoryPathShape,
      spatialExtent: shapeResult.analysis.spatialExtent,
      dominantJointIndices: [...shapeResult.analysis.trajectoryJointIndices],
      symmetry: shapeResult.analysis.symmetry,
    },
  };
  const observability = buildObservabilityAnalysis(
    normalized,
    jointMovement,
    regionSegmentMovements,
    regionActiveSegmentCounts,
    segmentSpeeds,
  );
  return {
    features,
    validFrameCount: validFrames.length,
    normalizedFrameCount: normalized.length,
    stableScale,
    origin,
    orientation,
    segmentMovements,
    segmentSpeeds,
    segmentDurations,
    centerSegmentMovements,
    jointMovement,
    activeJointThreshold: BODY_ACTIVE_JOINT_THRESHOLD,
    activeJointIndices,
    regionSegmentMovements,
    regionActiveSegmentCounts,
    activeIndexes,
    lastActiveIndex: lastActiveIndex ?? null,
    finalSequence,
    fastThreshold: BODY_FAST_SPEED_THRESHOLD,
    minimumFastSegments: BODY_MINIMUM_FAST_SEGMENTS,
    minimumFastDurationMs: BODY_MINIMUM_FAST_DURATION_MS,
    fastSegmentCount: longestFastSegments,
    fastDurationMs: longestFastDuration,
    hasSustainedFastMovement,
    endingSpeedRatio,
    inactiveTailDuration,
    endingBehavior,
    shape: shapeResult.analysis,
    ...observability,
  };
}

export function extractBodyMovementFeatures(frames: BodyPoseFrame[]): BodyMovementFeatures {
  return analyzeBodyMovement(frames).features;
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
  if (
    features.hasMeaningfulMovement &&
    (features.endingBehavior === "abrupt" || features.endingBehavior === "gradual")
  ) {
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
