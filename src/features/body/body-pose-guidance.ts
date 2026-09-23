import type { BodyLandmark } from "../../domain/body";

export const POSE_GUIDANCE_VISIBILITY_THRESHOLD = 0.35;
export const POSE_GUIDANCE_COLOR = "#c9a96a";

export type PoseGuidanceVariantId = "subtle-arms" | "subtle-arms-torso";

export type PoseGuidanceStyle = {
  id: PoseGuidanceVariantId;
  label: string;
  opacity: number;
  strokeWidth: number;
  includesShoulderHip: boolean;
};

export const POSE_GUIDANCE_STYLES: Record<PoseGuidanceVariantId, PoseGuidanceStyle> = {
  "subtle-arms": {
    id: "subtle-arms",
    label: "subtle arms",
    opacity: 0.28,
    strokeWidth: 1.2,
    includesShoulderHip: false,
  },
  "subtle-arms-torso": {
    id: "subtle-arms-torso",
    label: "subtle arms + limited torso",
    opacity: 0.22,
    strokeWidth: 1.1,
    includesShoulderHip: true,
  },
};

type LandmarkPair = readonly [number, number];

const ARM_PAIRS: readonly LandmarkPair[] = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];

const SHOULDER_HIP_PAIRS: readonly LandmarkPair[] = [
  [11, 23],
  [12, 24],
];

export type PoseGuidanceSegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

function isRenderableLandmark(landmark: BodyLandmark | undefined): boolean {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      (landmark.visibility ?? 1) >= POSE_GUIDANCE_VISIBILITY_THRESHOLD,
  );
}

/** Returns only reviewed, display-only pose segments; it never adds markers or head geometry. */
export function getPoseGuidanceSegments(
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
): PoseGuidanceSegment[] {
  if (!landmarks) return [];
  const style = POSE_GUIDANCE_STYLES[variant];
  const pairs = style.includesShoulderHip ? [...ARM_PAIRS, ...SHOULDER_HIP_PAIRS] : ARM_PAIRS;
  return pairs.flatMap(([fromIndex, toIndex]) => {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!isRenderableLandmark(from) || !isRenderableLandmark(to)) return [];
    return [{ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } }];
  });
}

export function drawPoseGuidance(
  context: CanvasRenderingContext2D,
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
  width: number,
  height: number,
): number {
  const style = POSE_GUIDANCE_STYLES[variant];
  const segments = getPoseGuidanceSegments(landmarks, variant);
  context.save();
  context.globalAlpha = style.opacity;
  context.strokeStyle = POSE_GUIDANCE_COLOR;
  context.lineWidth = Math.max(1, (width / 180) * style.strokeWidth);
  context.lineCap = "round";
  context.lineJoin = "round";
  segments.forEach(({ from, to }) => {
    context.beginPath();
    context.moveTo(from.x * width, from.y * height);
    context.lineTo(to.x * width, to.y * height);
    context.stroke();
  });
  context.restore();
  return segments.length;
}
