import { describe, expect, it } from "vitest";
import { appendPitchHistory, createPitchContourPath, estimatePitch } from "./voice";

function sineWave(frequency: number, sampleRate = 8000, length = 1024): number[] {
  return Array.from(
    { length },
    (_, index) => 128 + 80 * Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
}

describe("voice pitch visualization", () => {
  it("detects a low-frequency voiced signal", () => {
    const pitch = estimatePitch(sineWave(120), 8000);

    expect(pitch).not.toBeNull();
    expect(pitch).toBeCloseTo(120, -1);
  });

  it("detects a high-frequency voiced signal above a low signal", () => {
    const low = estimatePitch(sineWave(120), 8000);
    const high = estimatePitch(sineWave(280), 8000);

    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(high).toBeGreaterThan(low ?? 0);
  });

  it("returns no pitch for silence or unusable samples", () => {
    expect(estimatePitch(new Array(1024).fill(128), 8000)).toBeNull();
    expect(estimatePitch([], 8000)).toBeNull();
    expect(estimatePitch([Number.NaN, Number.NaN], 8000)).toBeNull();
  });

  it("scrolls history from left to right and leaves silence as a gap", () => {
    expect(createPitchContourPath([null, 120, 180, null, 280], 100, 40)).toBe(
      "M 25.00 29.22 L 50.00 18.43 M 100.00 6.68",
    );
  });

  it("drops the oldest history point as new points arrive", () => {
    expect(appendPitchHistory([100, 120, null], 180, 3)).toEqual([120, null, 180]);
  });
});
