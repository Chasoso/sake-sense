import { describe, expect, it } from "vitest";
import {
  createPaddedMask,
  extractIsoContours,
  polygonArea,
  RAW_MASK_ISO_LEVEL,
  selectPrimaryContour,
  simplifyContour,
  smoothContour,
  SEGMENTATION_THRESHOLD,
  thresholdSegmentationMask,
} from "./segmentation-mask-spike";

function maskValues(rows: number[][]): number[] {
  return rows.flat();
}

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
