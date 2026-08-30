import { describe, expect, it } from "vitest";
import { createWaveformPoints } from "./voice";

describe("voice waveform points", () => {
  it("keeps silence near the center line", () => {
    expect(createWaveformPoints([128, 128, 128])).toBe("0.00,32.00 160.00,32.00 320.00,32.00");
  });

  it("maps time-domain amplitude across the x axis", () => {
    expect(createWaveformPoints([0, 255], 100, 40)).toBe("0.00,2.00 100.00,37.86");
  });

  it("uses the center line for invalid samples", () => {
    expect(createWaveformPoints([Number.NaN])).toBe("0.00,32.00");
  });
});
