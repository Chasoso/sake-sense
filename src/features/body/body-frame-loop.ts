export type BodyFrameLoopMode = "idle" | "preview" | "recording";

export function shouldCollectBodyFrame(mode: BodyFrameLoopMode): boolean {
  return mode === "recording";
}

export function getBodyFrameElapsedMs(
  mode: BodyFrameLoopMode,
  timestamp: number,
  startedAt: number,
): number {
  return shouldCollectBodyFrame(mode) ? timestamp - startedAt : 0;
}
