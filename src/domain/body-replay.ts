import type { BodyPoseFrame } from "./body";

export function getReplayFrameIndex(frames: BodyPoseFrame[], elapsedMs: number): number {
  if (!frames.length || !Number.isFinite(elapsedMs)) return -1;
  if (elapsedMs <= frames[0].t) return 0;
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (elapsedMs >= frames[index].t) return index;
  }
  return 0;
}

export function getReplayDurationMs(frames: BodyPoseFrame[]): number {
  return frames.length ? Math.max(frames[frames.length - 1].t, 0) : 0;
}
