import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import {
  BODY_RENDER_VISIBILITY_THRESHOLD,
  getBodyContourForLandmarks,
  smoothDisplayLandmarks,
} from "./body-pose-renderer";
import {
  buildLimbContour,
  getBodyContourGeometry,
  UPPER_ARM_WIDTH_RATIO,
  WRIST_WIDTH_RATIO,
} from "./body-contour-geometry";

function landmarks(overrides: Partial<Record<number, Partial<BodyLandmark>>> = {}): BodyLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: 0.5 + index * 0.001,
    y: 0.5,
    visibility: 1,
    ...overrides[index],
  }));
}

describe("body pose renderer", () => {
  it("builds deterministic outer contours from a pose", () => {
    const input = landmarks({
      11: { x: 0.35, y: 0.35 },
      13: { x: 0.28, y: 0.5 },
      15: { x: 0.2, y: 0.62 },
      12: { x: 0.65, y: 0.35 },
      14: { x: 0.72, y: 0.5 },
      16: { x: 0.8, y: 0.62 },
    });
    const first = getBodyContourForLandmarks(input);
    expect(first).toEqual(getBodyContourForLandmarks(input));
    expect(first.leftArm?.points.length).toBeGreaterThan(4);
    expect(first.torso).not.toBeNull();
  });

  it("connects head, neck, torso, and legs as one contour system", () => {
    const input = landmarks({
      0: { x: 0.5, y: 0.16 },
      7: { x: 0.46, y: 0.18 },
      8: { x: 0.54, y: 0.18 },
      11: { x: 0.35, y: 0.35 },
      12: { x: 0.65, y: 0.35 },
      23: { x: 0.42, y: 0.72 },
      24: { x: 0.58, y: 0.72 },
    });
    const geometry = getBodyContourGeometry(input);
    expect(geometry.head).not.toBeNull();
    expect(geometry.neck).not.toBeNull();
    expect(geometry.torso).not.toBeNull();
    expect(geometry.leftLeg).not.toBeNull();
    expect("leftArm" in geometry).toBe(true);
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
    const geometry = getBodyContourGeometry(input);
    expect(geometry.leftArm).toBeNull();
    expect(geometry.rightArm).toBeNull();
  });

  it("uses a tapered width profile from shoulder to wrist", () => {
    const contour = buildLimbContour(
      [
        { x: 0.35, y: 0.35 },
        { x: 0.28, y: 0.5 },
        { x: 0.2, y: 0.62 },
      ],
      [UPPER_ARM_WIDTH_RATIO, UPPER_ARM_WIDTH_RATIO * 0.7, WRIST_WIDTH_RATIO],
    );
    expect(contour).not.toBeNull();
    expect(contour!.points.length).toBe(6);
    expect(contour!.points[0].x).not.toBe(contour!.points[3].x);
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
