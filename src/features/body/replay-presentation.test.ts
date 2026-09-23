import { describe, expect, it } from "vitest";
import type { BodyPoseFrame } from "../../domain/body";
import { createBodyHybridReplayFrame } from "./body-pose-guidance";
import { getBodyReplayPresentationFrame } from "./replay-presentation";

function poseFrame(t: number, x: number): BodyPoseFrame {
  return {
    t,
    landmarks: [{ x, y: 0.5, visibility: 1 }],
  };
}

describe("Body replay presentation frame selection", () => {
  it("selects the final pose and replay geometry for the initial preview", () => {
    const capturedFrames = [poseFrame(0, 0.2), poseFrame(100, 0.8)];
    const replayFrames = [
      createBodyHybridReplayFrame(0, [{ x: 20, y: 20 }], [], 100, 100),
      createBodyHybridReplayFrame(100, [{ x: 80, y: 80 }], [], 100, 100),
    ];

    const selected = getBodyReplayPresentationFrame(100, capturedFrames, replayFrames, null);

    expect(selected?.poseFrame).toBe(capturedFrames[1]);
    expect(selected?.geometry).toBe(replayFrames[1]);
  });

  it("uses the same time selection for an intermediate replay frame", () => {
    const capturedFrames = [poseFrame(0, 0.2), poseFrame(100, 0.8)];
    const replayFrames = [
      createBodyHybridReplayFrame(0, [{ x: 20, y: 20 }], [], 100, 100),
      createBodyHybridReplayFrame(100, [{ x: 80, y: 80 }], [], 100, 100),
    ];

    const selected = getBodyReplayPresentationFrame(50, capturedFrames, replayFrames, null);

    expect(selected?.poseFrame).toBe(capturedFrames[0]);
    expect(selected?.geometry).toBe(replayFrames[0]);
  });
});
