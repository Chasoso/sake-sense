import { describe, expect, it } from "vitest";
import { getReplayDurationMs, getReplayFrameIndex } from "./body-replay";
import type { BodyPoseFrame } from "./body";

const frames: BodyPoseFrame[] = [
  { t: 0, landmarks: [] },
  { t: 100, landmarks: [] },
  { t: 250, landmarks: [] },
];

describe("body movement replay timing", () => {
  it("selects the first frame at replay start", () => {
    expect(getReplayFrameIndex(frames, 0)).toBe(0);
  });

  it("selects the latest frame at or before the elapsed timestamp", () => {
    expect(getReplayFrameIndex(frames, 180)).toBe(1);
  });

  it("selects the final frame after the captured duration", () => {
    expect(getReplayFrameIndex(frames, 500)).toBe(2);
    expect(getReplayDurationMs(frames)).toBe(250);
  });

  it("returns a safe no-frame result for empty or invalid input", () => {
    expect(getReplayFrameIndex([], 0)).toBe(-1);
    expect(getReplayFrameIndex(frames, Number.NaN)).toBe(-1);
    expect(getReplayDurationMs([])).toBe(0);
  });
});
