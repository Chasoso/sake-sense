import { describe, expect, it } from "vitest";
import { getBodyFrameElapsedMs, shouldCollectBodyFrame } from "./body-frame-loop";

describe("Body frame loop modes", () => {
  it("keeps preview frames out of recording history and elapsed time", () => {
    expect(shouldCollectBodyFrame("preview")).toBe(false);
    expect(getBodyFrameElapsedMs("preview", 4200, 1000)).toBe(0);
  });

  it("collects elapsed time only in recording mode", () => {
    expect(shouldCollectBodyFrame("recording")).toBe(true);
    expect(getBodyFrameElapsedMs("recording", 4200, 1000)).toBe(3200);
    expect(shouldCollectBodyFrame("idle")).toBe(false);
  });
});
