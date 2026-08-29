import { describe, expect, it } from "vitest";
import { extractGestureFeatures, gestureToRepresentation, type GesturePoint } from "./gesture";

const shortSharpStroke: GesturePoint[] = [
  { x: 10, y: 40, t: 0 },
  { x: 80, y: 40, t: 100 },
  { x: 160, y: 40, t: 120 },
];

const longGradualStroke: GesturePoint[] = [
  { x: 0, y: 0, t: 0 },
  { x: 100, y: 0, t: 200 },
  { x: 200, y: 0, t: 400 },
  { x: 300, y: 0, t: 600 },
  { x: 310, y: 0, t: 700 },
  { x: 320, y: 0, t: 800 },
  { x: 330, y: 0, t: 900 },
  { x: 340, y: 0, t: 1000 },
];

describe("gesture feature extraction", () => {
  it("extracts deterministic duration, path, speed, spread, and ending features", () => {
    const features = extractGestureFeatures(shortSharpStroke);

    expect(features).toMatchObject({
      durationMs: 120,
      pathLength: 150,
      spread: 150,
      abruptEnding: true,
    });
    expect(features.averageSpeed).toBeCloseTo(150 / 120);
    expect(gestureToRepresentation(features).dimensions).toEqual([
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
      expect.objectContaining({ dimensionId: "shape", polarity: "sharp" }),
    ]);
  });

  it("recognizes a long stroke that slows down near the end as gradual", () => {
    const features = extractGestureFeatures(longGradualStroke);

    expect(features.abruptEnding).toBe(false);
    expect(features.endingSpeedRatio).toBeCloseTo(0.2);
    expect(gestureToRepresentation(features).dimensions).toEqual([
      expect.objectContaining({ dimensionId: "duration", polarity: "lingering" }),
      expect.objectContaining({ dimensionId: "shape", polarity: "round" }),
    ]);
  });

  it("distinguishes similar-duration strokes by their ending speed trend", () => {
    const abrupt = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 250 },
      { x: 200, y: 0, t: 500 },
      { x: 300, y: 0, t: 750 },
      { x: 400, y: 0, t: 1000 },
    ]);
    const gradual = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 250 },
      { x: 200, y: 0, t: 500 },
      { x: 300, y: 0, t: 750 },
      { x: 320, y: 0, t: 1000 },
    ]);

    expect(abrupt.durationMs).toBe(gradual.durationMs);
    expect(abrupt.abruptEnding).toBe(true);
    expect(gradual.abruptEnding).toBe(false);
  });

  it("keeps the ending classification across different sampling densities", () => {
    const sparseAbrupt = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 200, y: 0, t: 500 },
      { x: 400, y: 0, t: 1000 },
    ]);
    const denseAbrupt = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 250 },
      { x: 200, y: 0, t: 500 },
      { x: 300, y: 0, t: 750 },
      { x: 400, y: 0, t: 1000 },
    ]);
    const sparseGradual = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 200, y: 0, t: 500 },
      { x: 220, y: 0, t: 1000 },
    ]);
    const denseGradual = extractGestureFeatures([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 250 },
      { x: 200, y: 0, t: 500 },
      { x: 210, y: 0, t: 750 },
      { x: 220, y: 0, t: 1000 },
    ]);

    expect(sparseAbrupt.abruptEnding).toBe(denseAbrupt.abruptEnding);
    expect(sparseGradual.abruptEnding).toBe(denseGradual.abruptEnding);
    expect(sparseAbrupt.abruptEnding).toBe(true);
    expect(sparseGradual.abruptEnding).toBe(false);
  });
});
