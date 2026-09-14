import type { BodyPoseFrame } from "../../domain/body";

export type MotionPoint = { x: number; y: number };
export type MotionJoint =
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftHip"
  | "rightHip";

export type NormalizedMotionFrame = {
  tMs: number;
  joints: Record<MotionJoint, MotionPoint>;
};

export type PathShape =
  | "straight"
  | "out-and-back"
  | "curved"
  | "circular"
  | "oscillating"
  | "irregular";
export type EndingShape = "abrupt" | "gradual" | "sustained" | "unknown";

export type ExtendedMotionDescriptors = {
  durationMs: number;
  trajectory: {
    dominantDirection: "left" | "right" | "up" | "down" | "mixed" | "still";
    pathShape: PathShape;
    pathComplexity: number;
    spatialExtent: number;
  };
  dynamics: {
    meanSpeed: number;
    peakSpeed: number;
    speedVariation: number;
    accelerationTendency: "accelerating" | "decelerating" | "stable" | "mixed";
    smoothness: number;
  };
  rhythm: {
    repetitionCount: number;
    temporalRegularity: number;
    pauseCount: number;
    intervalVariation: number;
    amplitudeTrend: "growing" | "decaying" | "stable" | "mixed";
  };
  bodyUsage: {
    dominantJoints: MotionJoint[];
    leftRightAsymmetry: number;
    symmetry: number;
    participationExtent: number;
  };
  ending: {
    shape: EndingShape;
    finalAmplitude: number;
    decayDurationMs: number;
  };
};

export type MotionPhase = {
  startMs: number;
  endMs: number;
  label: "active" | "pause" | "decelerating" | "oscillating";
};

export type MotionSignature = {
  version: "motion-signature.v0";
  durationMs: number;
  trajectory: ExtendedMotionDescriptors["trajectory"];
  dynamics: ExtendedMotionDescriptors["dynamics"];
  rhythm: ExtendedMotionDescriptors["rhythm"];
  bodyUsage: ExtendedMotionDescriptors["bodyUsage"];
  ending: ExtendedMotionDescriptors["ending"];
  phases: MotionPhase[];
};

export type MotionFixture = {
  id: string;
  label: string;
  frames: BodyPoseFrame[];
  intendedDifference: string;
};
