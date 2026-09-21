import { describe, expect, it } from "vitest";
import {
  findBoundaryPixels,
  orderBoundaryPixels,
  SEGMENTATION_THRESHOLD,
  thresholdSegmentationMask,
} from "./segmentation-mask-spike";

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

  it("finds and deterministically orders the boundary of a small mask", () => {
    const mask = thresholdSegmentationMask([0, 1, 0, 1, 1, 1, 0, 1, 0], 3, 3);
    const boundary = findBoundaryPixels(mask);
    expect(boundary).toHaveLength(4);
    expect(orderBoundaryPixels(mask, boundary)).toEqual(orderBoundaryPixels(mask, boundary));
    expect(new Set(boundary.map(({ x, y }) => `${x}:${y}`))).toEqual(
      new Set(["1:0", "0:1", "2:1", "1:2"]),
    );
  });

  it("returns a safe empty contour for an empty mask", () => {
    const mask = thresholdSegmentationMask([0, 0, 0, 0], 2, 2);
    expect(findBoundaryPixels(mask)).toEqual([]);
    expect(orderBoundaryPixels(mask)).toEqual([]);
  });
});
