import { describe, expect, it } from "vitest";
import {
  clampReplayPosition,
  getReplayControlAction,
  getReplayStartTimestamp,
  transitionReplayStatus,
} from "./replay-control";

describe("replay control state", () => {
  it("starts initial and completed replay from the beginning", () => {
    expect(getReplayControlAction("initial")).toBe("restart");
    expect(transitionReplayStatus("initial", "start")).toBe("playing");
    expect(getReplayControlAction("completed")).toBe("restart");
    expect(transitionReplayStatus("completed", "start")).toBe("playing");
  });

  it("pauses and resumes without changing the control state semantics", () => {
    expect(getReplayControlAction("playing")).toBe("pause");
    expect(transitionReplayStatus("playing", "pause")).toBe("paused");
    expect(getReplayControlAction("paused")).toBe("resume");
    expect(transitionReplayStatus("paused", "resume")).toBe("playing");
  });

  it("preserves the paused playback position when resuming", () => {
    const pausedPosition = clampReplayPosition(420, 1000);
    expect(getReplayStartTimestamp(2000, pausedPosition)).toBe(1580);
    expect(clampReplayPosition(pausedPosition, 1000)).toBe(420);
  });

  it("supports repeated pause and resume transitions without restarting", () => {
    let status = transitionReplayStatus("initial", "start");
    status = transitionReplayStatus(status, "pause");
    status = transitionReplayStatus(status, "resume");
    status = transitionReplayStatus(status, "pause");
    expect(status).toBe("paused");
    expect(getReplayControlAction(status)).toBe("resume");
  });

  it("marks playback complete and resets on a new capture", () => {
    expect(transitionReplayStatus("playing", "complete")).toBe("completed");
    expect(transitionReplayStatus("completed", "reset")).toBe("initial");
    expect(transitionReplayStatus("paused", "reset")).toBe("initial");
  });

  it("does not allow invalid transitions to restart or pause unexpectedly", () => {
    expect(transitionReplayStatus("initial", "pause")).toBe("initial");
    expect(transitionReplayStatus("paused", "start")).toBe("paused");
    expect(transitionReplayStatus("completed", "resume")).toBe("completed");
  });
});
