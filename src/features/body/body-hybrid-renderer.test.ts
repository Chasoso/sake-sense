import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import { buildUpperBodyPoseGuides, HYBRID_POSE_MIN_VISIBILITY } from "./body-hybrid-renderer";

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
});
