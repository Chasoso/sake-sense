import type { BodyPoseFrame } from "../../domain/body";
import { describeMotion, segmentMotionPhases } from "./descriptors";
import type { MotionSignature } from "./types";

export function createMotionSignature(frames: BodyPoseFrame[]): MotionSignature {
  const descriptors = describeMotion(frames);
  return {
    version: "motion-signature.v0",
    durationMs: descriptors.durationMs,
    trajectory: descriptors.trajectory,
    dynamics: descriptors.dynamics,
    rhythm: descriptors.rhythm,
    bodyUsage: descriptors.bodyUsage,
    ending: descriptors.ending,
    phases: segmentMotionPhases(frames, descriptors),
  };
}
