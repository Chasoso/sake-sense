import { describe, expect, it } from "vitest";
import { extractVoiceFeatures } from "./voice";

describe("voice feature extraction", () => {
  it("extracts deterministic intensity, pauses, and ending behavior", () => {
    const features = extractVoiceFeatures(
      [
        { t: 0, level: 0.8 },
        { t: 500, level: 0.7 },
        { t: 1000, level: 0.1 },
        { t: 1500, level: 0.02 },
      ],
      1500,
    );

    expect(features.durationMs).toBe(1500);
    expect(features.averageIntensity).toBeCloseTo(0.405);
    expect(features.pauseCount).toBe(1);
    expect(features.endingBehavior).toBe("fading");
  });

  it("handles unavailable audio samples without inventing certainty", () => {
    expect(extractVoiceFeatures([], 0)).toEqual({
      durationMs: 0,
      averageIntensity: 0,
      pauseCount: 0,
      endingBehavior: "unknown",
    });
  });
});
