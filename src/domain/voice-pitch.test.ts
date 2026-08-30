import { describe, expect, it } from "vitest";
import {
  advanceWavePhase,
  appendWaveHistory,
  createSyntheticWavePath,
  estimatePitch,
  mapPitchToWaveFrequency,
  smoothWaveValue,
} from "./voice";

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

  it("maps low pitch to a longer period than high pitch", () => {
    expect(mapPitchToWaveFrequency(120)).toBeLessThan(mapPitchToWaveFrequency(280));
  });

  it("maps larger intensity to larger amplitude after smoothing", () => {
    const quiet = smoothWaveValue(0.1, 0.2);
    const loud = smoothWaveValue(0.1, 0.8);

    expect(loud).toBeGreaterThan(quiet);
    expect(
      createSyntheticWavePath([{ amplitude: loud, frequency: 2, phase: Math.PI / 2 }]),
    ).not.toBe(createSyntheticWavePath([{ amplitude: quiet, frequency: 2, phase: Math.PI / 2 }]));
  });

  it("keeps silence as a near-flat point in a continuous path", () => {
    const path = createSyntheticWavePath([
      { amplitude: 0, frequency: 2, phase: 0 },
      { amplitude: 0, frequency: 2, phase: 1 },
      { amplitude: 0, frequency: 2, phase: 2 },
    ]);

    expect(path).toBe("M 0.00 32.00 L 160.00 32.00 L 320.00 32.00");
  });

  it("preserves phase continuity between updates", () => {
    const next = advanceWavePhase(0.5, 4, 50);

    expect(next).toBeCloseTo(0.5 + 2 * Math.PI * 4 * 0.05);
    expect(next).not.toBe(0.5);
  });

  it("scrolls history and keeps the newest point at the right", () => {
    const first = { amplitude: 0.2, frequency: 2, phase: 0 };
    const second = { amplitude: 0.4, frequency: 4, phase: 1 };
    const history = appendWaveHistory([first, second], { ...second, phase: 2 }, 2);

    expect(history).toEqual([
      { ...second, phase: 1 },
      { ...second, phase: 2 },
    ]);
    expect(createSyntheticWavePath(history)).toContain("L 320.00");
  });
});
