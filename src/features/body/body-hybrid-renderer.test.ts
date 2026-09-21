import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import {
  buildArmBoundaryCandidates,
  buildArmGuideSegments,
  buildInternalBodyBoundaries,
  buildUpperBodyPoseGuides,
  filterBoundaryToPersonMask,
  HYBRID_FOREARM_HALF_WIDTH_PX,
  HYBRID_POSE_MIN_VISIBILITY,
  HYBRID_UPPER_ARM_HALF_WIDTH_PX,
  suppressBoundaryNearOuterContour,
} from "./body-hybrid-renderer";

function landmarks(overrides: Record<number, Partial<BodyLandmark>> = {}): BodyLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: index / 100,
    y: index / 100,
    visibility: 0.9,
    ...overrides[index],
  }));
}

describe("body hybrid renderer helpers", () => {
  it("builds deterministic arm and shoulder guides from visible landmarks", () => {
    const input = landmarks({
      11: { x: 0.3, y: 0.4 },
      12: { x: 0.7, y: 0.4 },
      13: { x: 0.2, y: 0.55 },
      14: { x: 0.8, y: 0.55 },
      15: { x: 0.1, y: 0.7 },
      16: { x: 0.9, y: 0.7 },
    });
    const snapshot = structuredClone(input);
    const first = buildUpperBodyPoseGuides(input);
    const second = buildUpperBodyPoseGuides(input);
    expect(first).toEqual(second);
    expect(first.leftArm?.points).toEqual([
      { x: 0.3, y: 0.4 },
      { x: 0.2, y: 0.55 },
      { x: 0.1, y: 0.7 },
    ]);
    expect(buildArmGuideSegments(first.leftArm!)).toEqual([
      { start: { x: 0.3, y: 0.4 }, end: { x: 0.2, y: 0.55 } },
      { start: { x: 0.2, y: 0.55 }, end: { x: 0.1, y: 0.7 } },
    ]);
    expect(first.rightArm?.points).toHaveLength(3);
    expect(first.shoulderLine).toEqual([
      { x: 0.3, y: 0.4 },
      { x: 0.7, y: 0.4 },
    ]);
    expect(input).toEqual(snapshot);
  });

  it("excludes low-visibility landmarks and does not fabricate a partial arm", () => {
    const input = landmarks({
      11: { x: 0.3, y: 0.4 },
      12: { x: 0.7, y: 0.4 },
      13: { x: 0.2, y: 0.55, visibility: HYBRID_POSE_MIN_VISIBILITY - 0.01 },
      14: { x: 0.8, y: 0.55 },
      15: { x: 0.1, y: 0.7 },
      16: { x: 0.9, y: 0.7 },
    });
    const guides = buildUpperBodyPoseGuides(input);
    expect(guides.leftArm).toBeNull();
    expect(guides.rightArm?.points).toHaveLength(3);
  });

  it("supports one-arm and partial-chain fallback without inventing a wrist", () => {
    const input = landmarks({
      11: { x: 0.3, y: 0.4 },
      13: { x: 0.2, y: 0.55 },
      15: { x: 0.1, y: 0.7, visibility: 0 },
      12: { x: 0.7, y: 0.4, visibility: 0 },
      14: { x: 0.8, y: 0.55, visibility: 0 },
      16: { x: 0.9, y: 0.7, visibility: 0 },
    });
    const guides = buildUpperBodyPoseGuides(input);
    expect(guides.leftArm?.points).toEqual([
      { x: 0.3, y: 0.4 },
      { x: 0.2, y: 0.55 },
    ]);
    expect(buildArmGuideSegments(guides.leftArm!)).toEqual([
      { start: { x: 0.3, y: 0.4 }, end: { x: 0.2, y: 0.55 } },
    ]);
    expect(guides.rightArm).toBeNull();
  });

  it("falls back to empty guidance when pose is unavailable", () => {
    expect(buildUpperBodyPoseGuides(null)).toEqual({
      leftArm: null,
      rightArm: null,
      shoulderLine: null,
      head: null,
      visibleLandmarkCount: 0,
      validArmChainCount: 0,
    });
  });

  it("creates both offset candidates for each available arm segment", () => {
    const guides = buildUpperBodyPoseGuides(
      landmarks({
        11: { x: 0.3, y: 0.5 },
        13: { x: 0.5, y: 0.5 },
        15: { x: 0.7, y: 0.5 },
        12: { visibility: 0 },
        14: { visibility: 0 },
        16: { visibility: 0 },
      }),
    );
    const candidates = buildArmBoundaryCandidates(guides.leftArm, 320, 180);
    expect(candidates).toHaveLength(4);
    expect(candidates[0].start.y).not.toBeCloseTo(candidates[2].start.y);
    expect(candidates[0].start.y).toBeCloseTo(candidates[0].end.y);
    expect(candidates).toEqual(buildArmBoundaryCandidates(guides.leftArm, 320, 180));
  });

  it.each([
    {
      name: "horizontal",
      points: [
        { x: 0.2, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0.8, y: 0.5 },
      ],
      widthPx: HYBRID_UPPER_ARM_HALF_WIDTH_PX,
    },
    {
      name: "vertical",
      points: [
        { x: 0.5, y: 0.2 },
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.8 },
      ],
      widthPx: HYBRID_UPPER_ARM_HALF_WIDTH_PX,
    },
  ])("keeps the $name boundary offset in source pixels", ({ points, widthPx }) => {
    const candidates = buildArmBoundaryCandidates({ points }, 320, 180);
    const candidate = candidates[0].start;
    const distancePx = Math.hypot(
      (candidate.x - points[0].x) * 320,
      (candidate.y - points[0].y) * 180,
    );
    expect(distancePx).toBeCloseTo(widthPx);
  });

  it("keeps diagonal candidates perpendicular in non-square source pixels", () => {
    const points = [
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.5 },
    ];
    const candidates = buildArmBoundaryCandidates({ points }, 320, 180);
    const centerVector = { x: 0.3 * 320, y: 0.3 * 180 };
    const offsetVector = {
      x: (candidates[0].start.x - points[0].x) * 320,
      y: (candidates[0].start.y - points[0].y) * 180,
    };
    expect(centerVector.x * offsetVector.x + centerVector.y * offsetVector.y).toBeCloseTo(0);
    expect(Math.hypot(offsetVector.x, offsetVector.y)).toBeCloseTo(HYBRID_UPPER_ARM_HALF_WIDTH_PX);
  });

  it("preserves normalized geometry when the source raster scales uniformly", () => {
    const points = [
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.5 },
    ];
    expect(buildArmBoundaryCandidates({ points }, 320, 180)).toEqual(
      buildArmBoundaryCandidates({ points }, 640, 360),
    );
  });

  it("returns no candidates for a zero-sized source", () => {
    const points = [
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.5 },
    ];
    expect(buildArmBoundaryCandidates({ points }, 0, 0)).toEqual([]);
    expect(HYBRID_FOREARM_HALF_WIDTH_PX).toBeGreaterThan(0);
  });

  it("keeps only candidate portions inside the person mask", () => {
    const mask = {
      width: 10,
      height: 10,
      data: new Uint8Array(100).fill(1),
    };
    const candidates = [
      { start: { x: -0.2, y: 0.5 }, end: { x: -0.1, y: 0.5 } },
      { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 } },
    ];
    expect(filterBoundaryToPersonMask(candidates, mask)).toEqual([candidates[1]]);
    expect(filterBoundaryToPersonMask(candidates, null)).toEqual([]);
  });

  it("suppresses outer-edge candidates while retaining internal candidates", () => {
    const outerContour = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const candidates = [
      { start: { x: 0.2, y: 0.01 }, end: { x: 0.8, y: 0.01 } },
      { start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 } },
    ];
    const retained = suppressBoundaryNearOuterContour(candidates, outerContour, 100, 100, 0.05);
    expect(retained).toEqual([candidates[1]]);
  });

  it("falls back to no internal boundaries without mask or outer contour", () => {
    const guides = buildUpperBodyPoseGuides(landmarks());
    expect(buildInternalBodyBoundaries(guides, null, null)).toEqual([]);
  });
});
