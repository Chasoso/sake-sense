import type { BodyPoseFrame } from "../../domain/body";
import { getReplayFrameIndex } from "../../domain/body-replay";
import {
  getBodyHybridReplayFrame,
  type BodyHybridDisplaySnapshot,
  type BodyHybridReplayFrame,
} from "./body-pose-guidance";

export type BodyReplayPresentationFrame = {
  poseFrame: BodyPoseFrame;
  geometry: BodyHybridReplayFrame | BodyHybridDisplaySnapshot | null;
};

export function getBodyReplayPresentationFrame(
  elapsedMs: number,
  capturedFrames: BodyPoseFrame[],
  hybridReplayFrames: readonly BodyHybridReplayFrame[],
  hybridSnapshot: BodyHybridDisplaySnapshot | null,
): BodyReplayPresentationFrame | null {
  const frameIndex = getReplayFrameIndex(capturedFrames, elapsedMs);
  if (frameIndex < 0) return null;
  return {
    poseFrame: capturedFrames[frameIndex],
    geometry: getBodyHybridReplayFrame(hybridReplayFrames, elapsedMs) ?? hybridSnapshot,
  };
}
