import { describe, expect, it } from "vitest";
import { extractGestureFeatures, gestureToRepresentation, type GesturePoint } from "./gesture";

const shortSharpStroke: GesturePoint[] = [
  { x: 10, y: 40, t: 0 },
  { x: 80, y: 40, t: 100 },
  { x: 90, y: 40, t: 120 },
];

describe("gesture feature extraction", () => {
  it("extracts deterministic duration, path, speed, spread, and ending features", () => {
    const features = extractGestureFeatures(shortSharpStroke);

    expect(features).toMatchObject({
      durationMs: 120,
      pathLength: 80,
      spread: 80,
      abruptEnding: true,
    });
    expect(features.averageSpeed).toBeCloseTo(80 / 120);
    expect(gestureToRepresentation(features).dimensions).toEqual([
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
      expect.objectContaining({ dimensionId: "shape", polarity: "sharp" }),
    ]);
  });
});
