import { describe, expect, it } from "vitest";
import {
  getObjectFitCoverTransform,
  projectNormalizedPointToCoverViewport,
} from "./body-camera-cover";

describe("body camera cover projection", () => {
  it("does not crop equal aspect ratios", () => {
    const transform = getObjectFitCoverTransform(1600, 900, 1600, 900);
    expect(transform.scale).toBe(1);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(0);
  });

  it("crops the source horizontally when the viewport is taller", () => {
    const transform = getObjectFitCoverTransform(1920, 1080, 1000, 1000);
    expect(transform.offsetX).toBeLessThan(0);
    expect(transform.offsetY).toBe(0);
  });

  it("crops the source vertically when the viewport is wider", () => {
    const transform = getObjectFitCoverTransform(1000, 1600, 1600, 1000);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBeLessThan(0);
  });

  it("keeps the normalized center at the viewport center", () => {
    const transform = getObjectFitCoverTransform(1920, 1080, 1000, 1000);
    expect(projectNormalizedPointToCoverViewport({ x: 0.5, y: 0.5 }, transform)).toEqual({
      x: 500,
      y: 500,
    });
  });

  it("projects edge points using the same crop and does not mirror them", () => {
    const transform = getObjectFitCoverTransform(1920, 1080, 1000, 1000);
    const left = projectNormalizedPointToCoverViewport({ x: 0, y: 0.5 }, transform);
    const right = projectNormalizedPointToCoverViewport({ x: 1, y: 0.5 }, transform);
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(1000);
    expect(left.y).toBe(500);
    expect(right.y).toBe(500);
  });
});
