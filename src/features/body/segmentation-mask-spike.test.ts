import { describe, expect, it } from "vitest";
import {
  alignContourToReference,
  averageClosedContour,
  ContourStabilizer,
  createPaddedMask,
  ensureContourWinding,
  extractIsoContours,
  polygonArea,
  RAW_MASK_ISO_LEVEL,
  resampleClosedContour,
  selectPrimaryContour,
  simplifyContour,
  smoothContour,
  SEGMENTATION_THRESHOLD,
  thresholdSegmentationMask,
} from "./segmentation-mask-spike";

function maskValues(rows: number[][]): number[] {
  return rows.flat();
}

const referenceContour = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 5, y: 2 },
  { x: 3, y: 4 },
  { x: 0, y: 3 },
];

describe("segmentation mask spike helpers", () => {
  it("thresholds a synthetic float mask without mutating the input", () => {
    const values = new Float32Array([0.1, 0.8, 0.7, 0.2]);
    const snapshot = [...values];
    expect(thresholdSegmentationMask(values, 2, 2)).toEqual({
      width: 2,
      height: 2,
      data: new Uint8Array([0, 1, 1, 0]),
    });
    expect([...values]).toEqual(snapshot);
    expect(SEGMENTATION_THRESHOLD).toBe(0.5);
  });

  it("extracts an ordered contour for a rectangle", () => {
    const values = maskValues([
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ]);
    const contours = extractIsoContours(values, 5, 5);
    expect(contours).toHaveLength(1);
    expect(polygonArea(contours[0])).toBeGreaterThan(5);
    expect(contours[0]).toEqual(extractIsoContours(values, 5, 5)[0]);
  });

  it("keeps a concave L-shaped region in local contour order", () => {
    const values = maskValues([
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0],
      [0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0],
    ]);
    const contour = selectPrimaryContour(extractIsoContours(values, 6, 6));
    expect(contour).not.toBeNull();
    expect(polygonArea(contour!)).toBeGreaterThan(5);
    expect(
      new Set(contour!.map((point) => `${point.x.toFixed(2)}:${point.y.toFixed(2)}`)).size,
    ).toBe(contour!.length);
  });

  it("selects the largest contour and ignores a detached island", () => {
    const values = maskValues([
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 1, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]);
    const contours = extractIsoContours(values, 7, 5);
    const primary = selectPrimaryContour(contours);
    expect(contours.length).toBeGreaterThan(1);
    expect(primary).not.toBeNull();
    expect(polygonArea(primary!)).toBeGreaterThan(4);
  });

  it("keeps a U-shaped concavity in the ordered contour", () => {
    const values = maskValues([
      [0, 1, 1, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ]);
    const contour = selectPrimaryContour(extractIsoContours(values, 5, 5));
    expect(contour).not.toBeNull();
    expect(polygonArea(contour!)).toBeGreaterThan(4);
    expect(contour!.some((point) => point.y < 1.5)).toBe(true);
  });

  it("returns a stable contour when the foreground touches the frame edge", () => {
    const values = maskValues([
      [1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
    ]);
    const contours = extractIsoContours(values, 4, 4);
    expect(contours.length).toBeGreaterThan(0);
    expect(selectPrimaryContour(contours)).toEqual(extractIsoContours(values, 4, 4)[0]);
  });

  it.each([
    {
      name: "left edge",
      values: maskValues([
        [1, 1, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ]),
      width: 5,
      height: 4,
    },
    {
      name: "top edge",
      values: maskValues([
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ]),
      width: 4,
      height: 4,
    },
    {
      name: "bottom edge",
      values: maskValues([
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 1, 1, 0],
      ]),
      width: 4,
      height: 4,
    },
    {
      name: "top-left corner",
      values: maskValues([
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      width: 4,
      height: 4,
    },
  ])("keeps a closed-area contour for the $name", ({ values, width, height }) => {
    const contours = extractIsoContours(values, width, height);
    const primary = selectPrimaryContour(contours);
    expect(primary).not.toBeNull();
    expect(primary!.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(primary!)).toBeGreaterThan(0);
    expect(primary).toEqual(selectPrimaryContour(extractIsoContours(values, width, height)));
  });

  it("pads without mutating the source and restores source coordinates", () => {
    const values = new Float32Array([0.8, 0.2, 0.2, 0.2]);
    const snapshot = [...values];
    const padded = createPaddedMask(values, 2, 2);
    expect(padded).toEqual({
      width: 4,
      height: 4,
      values: expect.any(Float32Array),
    });
    expect([...values]).toEqual(snapshot);
    expect(padded.values[1 + padded.width]).toBeCloseTo(0.8);
    const contour = selectPrimaryContour(extractIsoContours(values, 2, 2));
    expect(contour).not.toBeNull();
    expect(contour!.every((point) => point.x >= -0.5 && point.x <= 1.5)).toBe(true);
    expect(contour!.every((point) => point.y >= -0.5 && point.y <= 1.5)).toBe(true);
  });

  it("resamples closed contours at fixed, approximately equal arc-length spacing", () => {
    const snapshot = structuredClone(referenceContour);
    const resampled = resampleClosedContour(referenceContour, 20);
    const distances = resampled.map((point, index) => {
      const next = resampled[(index + 1) % resampled.length];
      return Math.hypot(next.x - point.x, next.y - point.y);
    });
    expect(resampled).toHaveLength(20);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.1);
    expect(referenceContour).toEqual(snapshot);
  });

  it("applies a circular spatial average without changing point count", () => {
    const noisy = [
      { x: 0, y: 0 },
      { x: 4.6, y: 0.3 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const snapshot = structuredClone(noisy);
    const averaged = averageClosedContour(noisy, 1);
    expect(averaged).toHaveLength(noisy.length);
    expect(averaged).toEqual(averageClosedContour(noisy, 1));
    expect(noisy).toEqual(snapshot);
    expect(averaged[1].x).toBeLessThan(noisy[1].x);
    expect(averaged[1].x).toBeGreaterThan(noisy[0].x);
  });

  it("leaves the contour geometry unchanged when spatial averaging is disabled", () => {
    const snapshot = structuredClone(referenceContour);
    expect(averageClosedContour(referenceContour, 0)).toEqual(referenceContour);
    expect(referenceContour).toEqual(snapshot);
  });

  it("normalizes both winding directions deterministically", () => {
    const clockwise = ensureContourWinding(referenceContour, "clockwise");
    const counterclockwise = ensureContourWinding([...referenceContour].reverse(), "clockwise");
    expect(counterclockwise).toEqual(clockwise);
    expect(ensureContourWinding(referenceContour, "clockwise")).toEqual(clockwise);
  });

  it("aligns a cyclically shifted contour to the reference without mutation", () => {
    const reference = resampleClosedContour(referenceContour, 24);
    const shifted = [...reference.slice(7), ...reference.slice(0, 7)];
    const snapshot = structuredClone(shifted);
    expect(alignContourToReference(shifted, reference)).toEqual(reference);
    expect(shifted).toEqual(snapshot);
  });

  it("stabilizes movement, initializes directly, and resets after reacquisition loss", () => {
    const stabilizer = new ContourStabilizer({
      pointCount: 8,
      temporalAlpha: 0.5,
      reacquireResetFrameCount: 2,
    });
    const first = resampleClosedContour(referenceContour, 8);
    const moved = first.map((point) => ({ x: point.x + 1, y: point.y + 1 }));
    expect(stabilizer.update(first).contour).toEqual(first);
    const blended = stabilizer.update(moved).contour!;
    expect(blended[0].x).toBeGreaterThan(first[0].x);
    expect(blended[0].x).toBeLessThan(moved[0].x);
    expect(stabilizer.update(null).held).toBe(true);
    expect(stabilizer.update(null).held).toBe(true);
    expect(stabilizer.update(null)).toMatchObject({ contour: null, reset: true });
    expect(stabilizer.update(moved).contour).toEqual(moved);
  });

  it("simplifies and spatially smooths without mutating the contour", () => {
    const source = extractIsoContours(
      maskValues([
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
      ]),
      5,
      5,
      RAW_MASK_ISO_LEVEL,
    )[0];
    const snapshot = structuredClone(source);
    const simplified = simplifyContour(source);
    const smoothed = smoothContour(simplified);
    expect(source).toEqual(snapshot);
    expect(simplified.length).toBeLessThanOrEqual(source.length);
    expect(smoothed.length).toBeGreaterThanOrEqual(3);
    expect(smoothed).toEqual(smoothContour(simplified));
  });
});
