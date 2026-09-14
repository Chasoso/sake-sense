import {
  BODY_FAST_SPEED_THRESHOLD,
  BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD,
  BODY_DIAGNOSTIC_MIN_VISIBLE_RATIO,
  BODY_MINIMUM_FAST_DURATION_MS,
  BODY_MINIMUM_FAST_SEGMENTS,
  BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
  BODY_REGION_ACTIVITY_THRESHOLD,
  analyzeBodyMovement,
  type BodyMovementAnalysis,
  type BodyPoseFrame,
  type BodyMovementFeatures,
} from "../../domain/body";
import { buildSensoryBridgeInput, type SensoryBridgeInput } from "../../domain/sensory-bridge";
import { describeMotion } from "./descriptors";
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
  observability: Record<
    string,
    {
      sampleCount: number;
      visibleSampleCount: number;
      visibilityRatio: number;
      meanVisibility: number;
      medianVisibility: number;
      minimumVisibility: number;
      p10Visibility: number;
      movement: number;
      observable: boolean;
      currentlyActive: boolean;
      visibleDurationMs: number;
      movementPerVisibleSecond: number;
      movementPerVisibleSample: number;
    }
  >;
  topMovingJoints: Array<{
    joint: string;
    movement: number;
    contributionRatio: number;
    visibilityRatio: number;
    observable: boolean;
    currentlyActive: boolean;
  }>;
};

export type RegionActivityDiagnostic = Record<
  "leftArm" | "rightArm" | "torso" | "lowerBody",
  {
    constituentJoints: string[];
    observableJointCount: number;
    totalJointCount: number;
    observableRatio: number;
    cumulativeMovement: number;
    activeSegmentCount: number;
    activityThreshold: number;
    meetsMeaningfulActiveCriteria: boolean;
    activityRatio: number;
    observableOnlyCumulativeMovement: number;
    observableOnlyActiveSegmentCount: number;
    observableOnlyActivityRatio: number;
    observableOnlyMeetsMeaningfulActiveCriteria: boolean;
    current: {
      cumulativeMovement: number;
      activeSegmentCount: number;
      activityRatio: number;
      meetsMeaningfulActiveCriteria: boolean;
    };
    observableOnly: {
      cumulativeMovement: number;
      activeSegmentCount: number;
      activityRatio: number;
      meetsMeaningfulActiveCriteria: boolean;
    };
  }
>;

export type SpeedDiagnostic = {
  meanSegmentSpeed: number;
  medianSegmentSpeed: number;
  p90SegmentSpeed: number;
  currentFastThreshold: number;
  fastSegmentCount: number;
  fastDurationMs: number;
  minimumFastSegments: number;
  minimumFastDurationMs: number;
  hasSustainedFastMovement: boolean;
};

export type ObservabilityExperimentDiagnostic = {
  diagnosticVisibilityThreshold: number;
  minimumVisibleRatio: number;
  observableJointCount: number;
  observableActiveJointCount: number;
  observableRegions: string[];
  activeObservableRegions: string[];
  participationIfUnobservedIgnored: BodyMovementFeatures["motionShape"]["participation"];
};

export type DirectionDiagnostic = {
  orientation: BodyMovementAnalysis["orientation"];
  movingJoints: string[];
  representativeJoint: string | null;
  representativePath: {
    length: number;
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  };
  centerPath: {
    length: number;
    start: { x: number; y: number } | null;
    end: { x: number; y: number } | null;
  };
  relativeHorizontal: number;
  relativeVertical: number;
  centerHorizontal: number;
  centerVertical: number;
  relativeMagnitude: number;
  centerMagnitude: number;
  selectedSource: "relative" | "center" | "none";
  selectedHorizontal: number;
  selectedVertical: number;
  result: BodyMovementFeatures["motionShape"]["dominantDirection"];
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
  observabilityExperiment: ObservabilityExperimentDiagnostic;
  speedObservabilityComparison: {
    currentMedian: number;
    observableOnlyMedian: number;
    upperBodyOnlyMedian: number;
  };
  shapeDebug: {
    expansion: Pick<
      BodyMovementAnalysis["shape"],
      "radialStart" | "radialEnd" | "radialChange" | "expansionThreshold" | "expansion"
    >;
    repetition: Pick<
      BodyMovementAnalysis["shape"],
      | "repetitionAxis"
      | "xRange"
      | "yRange"
      | "reversalCount"
      | "repetitionThreshold"
      | "repetition"
    >;
    participation: Pick<
      BodyMovementAnalysis["shape"],
      "activeRegionCount" | "regionCount" | "broadParticipationRatio" | "participation"
    >;
  };
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
const REGION_NAMES = ["leftArm", "rightArm", "torso", "lowerBody"] as const;

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

function buildJointDiagnostic(analysis: BodyMovementAnalysis): JointMovementDiagnostic {
  const cumulativeMovement = Object.fromEntries(
    analysis.jointMovement.map((movement, index) => [nameForJoint(index), movement]),
  );
  const total = analysis.jointMovement.reduce((sum, value) => sum + value, 0);
  const ordered = analysis.jointMovement
    .map((movement, index) => ({ index, movement }))
    .sort((left, right) => right.movement - left.movement);
  return {
    cumulativeMovement,
    observability: Object.fromEntries(
      analysis.jointObservability.map((observability, index) => [
        nameForJoint(index),
        {
          sampleCount: observability.sampleCount,
          visibleSampleCount: observability.visibleSampleCount,
          visibilityRatio: observability.visibilityRatio,
          meanVisibility: observability.meanVisibility,
          medianVisibility: observability.medianVisibility,
          minimumVisibility: observability.minimumVisibility,
          p10Visibility: observability.p10Visibility,
          movement: observability.currentMovement,
          observable: observability.observable,
          currentlyActive: observability.currentlyActive,
          visibleDurationMs: observability.visibleDurationMs,
          movementPerVisibleSecond: observability.movementPerVisibleSecond,
          movementPerVisibleSample: observability.movementPerVisibleSample,
        },
      ]),
    ),
    activeJointsByCurrentThreshold: analysis.activeJointIndices.map(nameForJoint),
    topMovingJoints: ordered.slice(0, 8).map(({ index, movement }) => ({
      joint: nameForJoint(index),
      movement,
      contributionRatio: total > 0 ? movement / total : 0,
      visibilityRatio: analysis.jointObservability[index]?.visibilityRatio ?? 0,
      observable: analysis.jointObservability[index]?.observable ?? false,
      currentlyActive: analysis.jointObservability[index]?.currentlyActive ?? false,
    })),
  };
}

function buildRegionDiagnostic(analysis: BodyMovementAnalysis): RegionActivityDiagnostic {
  const result = {} as RegionActivityDiagnostic;
  REGION_NAMES.forEach((region, index) => {
    const movements = analysis.regionSegmentMovements[index] ?? [];
    const activeSegmentCount = analysis.regionActiveSegmentCounts[index] ?? 0;
    const observability = analysis.regionObservability[index];
    result[region] = {
      constituentJoints: observability.jointIndices.map(nameForJoint),
      observableJointCount: observability.observableJointCount,
      totalJointCount: observability.totalJointCount,
      observableRatio: observability.observableRatio,
      cumulativeMovement: movements.reduce((sum, movement) => sum + movement, 0),
      activeSegmentCount,
      activityThreshold: BODY_REGION_ACTIVITY_THRESHOLD,
      meetsMeaningfulActiveCriteria: activeSegmentCount >= BODY_MINIMUM_REGION_ACTIVE_SEGMENTS,
      activityRatio: movements.length ? activeSegmentCount / movements.length : 0,
      observableOnlyCumulativeMovement: observability.observableOnlyCumulativeMovement,
      observableOnlyActiveSegmentCount: observability.observableOnlyActiveSegmentCount,
      observableOnlyActivityRatio: observability.observableOnlyActivityRatio,
      observableOnlyMeetsMeaningfulActiveCriteria:
        observability.observableOnlyMeetsMeaningfulActiveCriteria,
      current: {
        cumulativeMovement: observability.currentCumulativeMovement,
        activeSegmentCount: observability.currentActiveSegmentCount,
        activityRatio: observability.currentActivityRatio,
        meetsMeaningfulActiveCriteria: observability.currentlyCountsAsActiveRegion,
      },
      observableOnly: {
        cumulativeMovement: observability.observableOnlyCumulativeMovement,
        activeSegmentCount: observability.observableOnlyActiveSegmentCount,
        activityRatio: observability.observableOnlyActivityRatio,
        meetsMeaningfulActiveCriteria: observability.observableOnlyMeetsMeaningfulActiveCriteria,
      },
    };
  });
  return result;
}

function buildSpeedDiagnostic(analysis: BodyMovementAnalysis): SpeedDiagnostic {
  const speeds = analysis.segmentSpeeds;
  return {
    meanSegmentSpeed: speeds.length
      ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
      : 0,
    medianSegmentSpeed: median(speeds),
    p90SegmentSpeed: percentile(speeds, 0.9),
    currentFastThreshold: BODY_FAST_SPEED_THRESHOLD,
    fastSegmentCount: analysis.fastSegmentCount,
    fastDurationMs: analysis.fastDurationMs,
    minimumFastSegments: BODY_MINIMUM_FAST_SEGMENTS,
    minimumFastDurationMs: BODY_MINIMUM_FAST_DURATION_MS,
    hasSustainedFastMovement: analysis.hasSustainedFastMovement,
  };
}

function buildDirectionDiagnostic(analysis: BodyMovementAnalysis): DirectionDiagnostic {
  const shape = analysis.shape;
  const selected = shape.selectedProjection;
  return {
    orientation: analysis.orientation,
    movingJoints: shape.movingJoints.map(nameForJoint),
    representativeJoint:
      shape.representativeJoint === null ? null : nameForJoint(shape.representativeJoint),
    representativePath: {
      length: shape.representativePath,
      start: shape.representativeStart,
      end: shape.representativeEnd,
    },
    centerPath: { length: shape.centerPath, start: shape.centerStart, end: shape.centerEnd },
    relativeHorizontal: shape.relativeProjection?.horizontal ?? 0,
    relativeVertical: shape.relativeProjection?.vertical ?? 0,
    centerHorizontal: shape.centerProjection?.horizontal ?? 0,
    centerVertical: shape.centerProjection?.vertical ?? 0,
    relativeMagnitude: shape.relativeMagnitude,
    centerMagnitude: shape.centerMagnitude,
    selectedSource: shape.selectedSource,
    selectedHorizontal: selected?.horizontal ?? 0,
    selectedVertical: selected?.vertical ?? 0,
    result: shape.dominantDirection,
  };
}

export function createRealCaptureDiagnostics(
  frames: BodyPoseFrame[],
  sampleAttempts = frames.length,
  invalidFrameCount = Math.max(sampleAttempts - frames.length, 0),
): MotionExperimentDiagnostic {
  const analysis = analyzeBodyMovement(frames);
  const current = analysis.features;
  const coarse = buildSensoryBridgeInput(current);
  const extended = describeMotion(frames);
  const signature = createMotionSignature(frames);
  const metadataDuration = frames.length > 1 ? Math.max(frames.at(-1)!.t - frames[0].t, 0) : 0;
  return {
    capture: {
      frameCount: frames.length,
      captureDurationMs: metadataDuration,
      approximateFrameRate:
        metadataDuration > 0 ? (frames.length - 1) / (metadataDuration / 1000) : 0,
      validFrameCount: analysis.validFrameCount,
      invalidFrameCount,
    },
    current,
    coarse,
    extended,
    signature,
    jointMovement: buildJointDiagnostic(analysis),
    regionActivity: buildRegionDiagnostic(analysis),
    speed: buildSpeedDiagnostic(analysis),
    directionDebug: buildDirectionDiagnostic(analysis),
    observabilityExperiment: {
      diagnosticVisibilityThreshold: BODY_DIAGNOSTIC_VISIBILITY_THRESHOLD,
      minimumVisibleRatio: BODY_DIAGNOSTIC_MIN_VISIBLE_RATIO,
      observableJointCount: analysis.observabilityExperiment.observableJointCount,
      observableActiveJointCount: analysis.observabilityExperiment.observableActiveJointCount,
      observableRegions: analysis.observabilityExperiment.observableRegions.map(
        (index) => REGION_NAMES[index],
      ),
      activeObservableRegions: analysis.observabilityExperiment.activeObservableRegions.map(
        (index) => REGION_NAMES[index],
      ),
      participationIfUnobservedIgnored:
        analysis.observabilityExperiment.participationIfUnobservedIgnored,
    },
    speedObservabilityComparison: {
      currentMedian: analysis.speedObservability.currentMedian,
      observableOnlyMedian: analysis.speedObservability.observableOnlyMedian,
      upperBodyOnlyMedian: analysis.speedObservability.upperBodyOnlyMedian,
    },
    shapeDebug: {
      expansion: {
        radialStart: analysis.shape.radialStart,
        radialEnd: analysis.shape.radialEnd,
        radialChange: analysis.shape.radialChange,
        expansionThreshold: analysis.shape.expansionThreshold,
        expansion: analysis.shape.expansion,
      },
      repetition: {
        repetitionAxis: analysis.shape.repetitionAxis,
        xRange: analysis.shape.xRange,
        yRange: analysis.shape.yRange,
        reversalCount: analysis.shape.reversalCount,
        repetitionThreshold: analysis.shape.repetitionThreshold,
        repetition: analysis.shape.repetition,
      },
      participation: {
        activeRegionCount: analysis.shape.activeRegionCount,
        regionCount: analysis.shape.regionCount,
        broadParticipationRatio: analysis.shape.broadParticipationRatio,
        participation: analysis.shape.participation,
      },
    },
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
