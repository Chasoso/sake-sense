import { describe, expect, it } from "vitest";
import { isBodySegmentationEnabled } from "./body-pose";

describe("body segmentation URL option", () => {
  it("keeps segmentation enabled by default", () => {
    expect(isBodySegmentationEnabled("")).toBe(true);
    expect(isBodySegmentationEnabled("?bodySegmentation=on")).toBe(true);
  });

  it("disables segmentation only for the explicit off value", () => {
    expect(isBodySegmentationEnabled("?bodySegmentation=off")).toBe(false);
    expect(isBodySegmentationEnabled("?bodySegmentation=off&mode=body")).toBe(false);
    expect(isBodySegmentationEnabled("?bodySegmentation=OFF")).toBe(true);
  });
});
