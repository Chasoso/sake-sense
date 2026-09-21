import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import {
  BODY_RENDER_VISIBILITY_THRESHOLD,
  getCurvedBodyGeometry,
  smoothDisplayLandmarks,
} from "./body-pose-renderer";

function landmarks(overrides: Partial<Record<number, Partial<BodyLandmark>>> = {}): BodyLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0.5 + index * 0.001,
    y: 0.5,
    visibility: 1,
    ...overrides[index],
  }));
}

describe("body pose renderer", () => {
  it("builds deterministic curved arm geometry from shoulder, elbow, and wrist", () => {
    const input = landmarks({
      11: { x: 0.35, y: 0.35 },
      13: { x: 0.28, y: 0.5 },
      15: { x: 0.2, y: 0.62 },
      12: { x: 0.65, y: 0.35 },
      14: { x: 0.72, y: 0.5 },
      16: { x: 0.8, y: 0.62 },
    });
    const first = getCurvedBodyGeometry(input);
    expect(first).toEqual(getCurvedBodyGeometry(input));
    expect(first.leftArm).toEqual({
      start: { x: 0.35, y: 0.35 },
      control: { x: 0.28, y: 0.5 },
      end: { x: 0.2, y: 0.62 },
    });
    expect(first.rightArm?.control).toEqual({ x: 0.72, y: 0.5 });
  });

  it("does not fabricate an arm when an elbow or wrist is not visible", () => {
    const input = landmarks({
      11: { x: 0.35, y: 0.35 },
      13: { visibility: BODY_RENDER_VISIBILITY_THRESHOLD - 0.01 },
      15: { x: 0.2, y: 0.62 },
      12: { x: 0.65, y: 0.35 },
      14: { x: 0.72, y: 0.5 },
      16: { visibility: BODY_RENDER_VISIBILITY_THRESHOLD - 0.01 },
    });
    const geometry = getCurvedBodyGeometry(input);
    expect(geometry.leftArm).toBeNull();
    expect(geometry.rightArm).toBeNull();
  });

  it("smooths only displayed coordinates without mutating raw landmarks", () => {
    const previous = landmarks({ 15: { x: 0.2, y: 0.4 } });
    const current = landmarks({ 15: { x: 0.6, y: 0.8 } });
    const rawSnapshot = structuredClone(current);
    const displayed = smoothDisplayLandmarks(previous, current, 0.25);
    expect(displayed[15].x).toBeCloseTo(0.5);
    expect(displayed[15].y).toBeCloseTo(0.7);
    expect(current).toEqual(rawSnapshot);
  });

  it("does not bridge a missing or low-visibility landmark", () => {
    const previous = landmarks({ 15: { x: 0.2, y: 0.4 } });
    const current = landmarks({ 15: { x: 0.9, y: 0.9, visibility: 0.1 } });
    const displayed = smoothDisplayLandmarks(previous, current);
    expect(displayed[15]).toEqual(current[15]);
  });

  it("starts a new smoothing sequence after reset input", () => {
    const current = landmarks({ 15: { x: 0.7, y: 0.7 } });
    const displayed = smoothDisplayLandmarks(null, current);
    expect(displayed[15].x).toBe(0.7);
    expect(displayed[15].y).toBe(0.7);
  });
});
