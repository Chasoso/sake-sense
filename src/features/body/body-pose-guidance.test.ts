import { describe, expect, it } from "vitest";
import type { BodyLandmark } from "../../domain/body";
import { BODY_POSE_UPPER_BODY_CONNECTIONS } from "./body-pose-connections";
import {
  getPoseGuidanceCurveSegments,
  getPoseGuidancePaths,
  getPoseGuidanceSegments,
  POSE_GUIDANCE_STYLES,
  POSE_GUIDANCE_VISIBILITY_THRESHOLD,
} from "./body-pose-guidance";

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

  it("adds upper-body and conditional hip guidance in the limited torso variant", () => {
    expect(getPoseGuidanceSegments(landmarks(), "subtle-arms-torso")).toHaveLength(8);
  });

  it("uses the shared upper-body topology without adding center geometry", () => {
    const source = landmarks();
    const paths = getPoseGuidancePaths(source, "subtle-arms-torso");
    const indexByPoint = new Map(source.map((point, index) => [`${point.x}:${point.y}`, index]));
    const pairs = paths.map(({ points }) =>
      points.map((point) => indexByPoint.get(`${point.x}:${point.y}`)),
    );
    expect(pairs).toEqual(BODY_POSE_UPPER_BODY_CONNECTIONS);
  });

  it("keeps upper-body torso guidance when hips are unavailable", () => {
    const source = landmarks();
    source[23] = undefined as unknown as BodyLandmark;
    source[24] = undefined as unknown as BodyLandmark;
    const paths = getPoseGuidancePaths(source, "subtle-arms-torso");
    expect(paths).toHaveLength(5);
    expect(getPoseGuidanceSegments(source, "subtle-arms-torso")).toHaveLength(5);
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

  it("uses only nose and mouth landmarks for the face direction cue", () => {
    const paths = getPoseGuidancePaths(landmarks(), "subtle-arms-torso-face");
    expect(paths).toHaveLength(10);
    const facePaths = paths.filter(({ kind }) => kind === "face");
    expect(facePaths).toHaveLength(2);
    expect(facePaths.flatMap(({ points }) => points).every(({ x }) => x <= 0.1)).toBe(true);
  });

  it("omits face guidance when a required face landmark is low confidence", () => {
    const source = landmarks();
    source[10].visibility = POSE_GUIDANCE_VISIBILITY_THRESHOLD - 0.01;
    expect(getPoseGuidancePaths(source, "subtle-arms-torso-face")).toHaveLength(8);
  });

  it("does not add joint markers, head geometry, or mutate input", () => {
    const source = landmarks();
    const snapshot = structuredClone(source);
    const segments = getPoseGuidanceSegments(source, "subtle-arms-torso");
    expect(segments.every((segment) => "from" in segment && "to" in segment)).toBe(true);
    expect(segments).toHaveLength(8);
    expect(source).toEqual(snapshot);
  });

  it("keeps pose visually subordinate through named style values", () => {
    expect(POSE_GUIDANCE_STYLES["subtle-arms"].opacity).toBeLessThan(0.5);
    expect(POSE_GUIDANCE_STYLES["subtle-arms"].strokeWidth).toBeLessThan(2);
    expect(POSE_GUIDANCE_STYLES["subtle-arms-torso"].opacity).toBeLessThan(
      POSE_GUIDANCE_STYLES["subtle-arms"].opacity,
    );
    expect(POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].faceOpacity).toBeLessThan(
      POSE_GUIDANCE_STYLES["subtle-arms-torso"].opacity,
    );
    expect(POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].faceStrokeWidth).toBeLessThan(
      POSE_GUIDANCE_STYLES["subtle-arms-torso"].strokeWidth,
    );
  });

  it("creates deterministic curved paths without mutating landmarks", () => {
    const source = landmarks();
    const snapshot = structuredClone(source);
    const first = getPoseGuidancePaths(source, "subtle-arms-torso-face");
    expect(getPoseGuidancePaths(source, "subtle-arms-torso-face")).toEqual(first);
    expect(source).toEqual(snapshot);
    expect(first.every(({ points }) => points.length >= 2)).toBe(true);
    const curves = getPoseGuidanceCurveSegments(source, "subtle-arms-torso-face");
    expect(curves).toHaveLength(10);
    expect(
      curves.some(
        ({ from, control, to }) =>
          control.x !== (from.x + to.x) / 2 || control.y !== (from.y + to.y) / 2,
      ),
    ).toBe(true);
  });
});
