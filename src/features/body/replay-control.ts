export type ReplayStatus = "initial" | "playing" | "paused" | "completed";

export type ReplayAction = "start" | "pause" | "resume" | "complete" | "reset";

export function transitionReplayStatus(status: ReplayStatus, action: ReplayAction): ReplayStatus {
  if (action === "reset") return "initial";
  if (action === "complete") return "completed";
  if (action === "start" && (status === "initial" || status === "completed")) return "playing";
  if (action === "pause" && status === "playing") return "paused";
  if (action === "resume" && status === "paused") return "playing";
  return status;
}

export function getReplayControlAction(status: ReplayStatus): "restart" | "pause" | "resume" {
  if (status === "playing") return "pause";
  if (status === "paused") return "resume";
  return "restart";
}

export function clampReplayPosition(positionMs: number, durationMs: number): number {
  return Math.min(Math.max(positionMs, 0), Math.max(durationMs, 0));
}

export function getReplayStartTimestamp(nowMs: number, positionMs: number): number {
  return nowMs - Math.max(positionMs, 0);
}
