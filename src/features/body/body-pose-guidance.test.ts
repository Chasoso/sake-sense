import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import { getPoseGuidanceSegments, POSE_GUIDANCE_STYLES } from "./body-pose-guidance";

function landmarks(): BodyLandmark[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: index / 100,
    y: index / 100,
    visibility: 1,
  }));
}

describe("body pose guidance", () => {
  it("returns only the reviewed arm subset for the arms variant", () => {
    expect(getPoseGuidanceSegments(landmarks(), "subtle-arms")).toHaveLength(4);
  });

  it("adds only paired shoulder-to-hip guidance in the limited torso variant", () => {
    expect(getPoseGuidanceSegments(landmarks(), "subtle-arms-torso")).toHaveLength(6);
  });

  it("omits a segment when either endpoint is missing or below confidence", () => {
    const source = landmarks();
    source[13] = undefined as unknown as BodyLandmark;
    expect(getPoseGuidanceSegments(source, "subtle-arms")).toHaveLength(2);
  });

  it("fails closed for unavailable landmarks", () => {
    expect(getPoseGuidanceSegments(null, "subtle-arms")).toEqual([]);
    expect(getPoseGuidanceSegments([], "subtle-arms-torso")).toEqual([]);
  });

  it("does not add joint markers, head geometry, or mutate input", () => {
    const source = landmarks();
    const snapshot = structuredClone(source);
    const segments = getPoseGuidanceSegments(source, "subtle-arms-torso");
    expect(segments.every((segment) => "from" in segment && "to" in segment)).toBe(true);
    expect(segments).toHaveLength(6);
    expect(source).toEqual(snapshot);
  });

  it("keeps pose visually subordinate through named style values", () => {
    expect(POSE_GUIDANCE_STYLES["subtle-arms"].opacity).toBeLessThan(0.5);
    expect(POSE_GUIDANCE_STYLES["subtle-arms"].strokeWidth).toBeLessThan(2);
    expect(POSE_GUIDANCE_STYLES["subtle-arms-torso"].opacity).toBeLessThan(
      POSE_GUIDANCE_STYLES["subtle-arms"].opacity,
    );
  });
});
