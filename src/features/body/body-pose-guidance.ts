import type { BodyLandmark } from "../../domain/body";

export const POSE_GUIDANCE_VISIBILITY_THRESHOLD = 0.35;
export const POSE_GUIDANCE_COLOR = "#c9a96a";

export type PoseGuidanceVariantId = "subtle-arms" | "subtle-arms-torso" | "subtle-arms-torso-face";

export type PoseGuidanceStyle = {
  id: PoseGuidanceVariantId;
  label: string;
  opacity: number;
  strokeWidth: number;
  includesShoulderHip: boolean;
  includesUpperBodyTorso: boolean;
  includesFace: boolean;
  faceOpacity: number;
  faceStrokeWidth: number;
};

export const POSE_GUIDANCE_STYLES: Record<PoseGuidanceVariantId, PoseGuidanceStyle> = {
  "subtle-arms": {
    id: "subtle-arms",
    label: "subtle arms",
    opacity: 0.28,
    strokeWidth: 1.2,
    includesShoulderHip: false,
    includesUpperBodyTorso: false,
    includesFace: false,
    faceOpacity: 0,
    faceStrokeWidth: 0,
  },
  "subtle-arms-torso": {
    id: "subtle-arms-torso",
    label: "subtle arms + limited torso",
    opacity: 0.22,
    strokeWidth: 1.1,
    includesShoulderHip: true,
    includesUpperBodyTorso: true,
    includesFace: false,
    faceOpacity: 0,
    faceStrokeWidth: 0,
  },
  "subtle-arms-torso-face": {
    id: "subtle-arms-torso-face",
    label: "subtle arms + torso + face direction",
    opacity: 0.22,
    strokeWidth: 1.1,
    includesShoulderHip: true,
    includesUpperBodyTorso: true,
    includesFace: true,
    faceOpacity: 0.12,
    faceStrokeWidth: 0.75,
  },
};

type LandmarkPair = readonly [number, number];

const ARM_CHAINS: readonly (readonly [number, number, number])[] = [
  [11, 13, 15],
  [12, 14, 16],
];

const SHOULDER_HIP_PAIRS: readonly LandmarkPair[] = [
  [11, 23],
  [12, 24],
];

const SHOULDER_LINE_PAIR: LandmarkPair = [11, 12];
const UPPER_BODY_CENTER_CUE_RATIO = 0.28;
const UPPER_BODY_CENTER_CUE_MAX_LENGTH = 0.12;

export type PoseGuidanceSegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type PoseGuidancePath = {
  points: Array<{ x: number; y: number }>;
  kind: "body" | "face";
};

function isRenderableLandmark(landmark: BodyLandmark | undefined): boolean {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      (landmark.visibility ?? 1) >= POSE_GUIDANCE_VISIBILITY_THRESHOLD,
  );
}

function getPath(
  landmarks: readonly BodyLandmark[],
  indexes: readonly number[],
  kind: "body" | "face",
): PoseGuidancePath | null {
  const points = indexes.map((index) => landmarks[index]);
  if (points.some((landmark) => !isRenderableLandmark(landmark))) return null;
  return {
    points: points.map((landmark) => ({ x: landmark!.x, y: landmark!.y })),
    kind,
  };
}

function getFacePaths(landmarks: readonly BodyLandmark[]): PoseGuidancePath[] {
  const nose = landmarks[0];
  const mouthLeft = landmarks[9];
  const mouthRight = landmarks[10];
  if (
    !isRenderableLandmark(nose) ||
    !isRenderableLandmark(mouthLeft) ||
    !isRenderableLandmark(mouthRight)
  ) {
    return [];
  }
  const mouthCenter = {
    x: (mouthLeft.x + mouthRight.x) / 2,
    y: (mouthLeft.y + mouthRight.y) / 2,
  };
  const shortNoseEnd = {
    x: nose.x + (mouthCenter.x - nose.x) * 0.35,
    y: nose.y + (mouthCenter.y - nose.y) * 0.35,
  };
  return [
    { points: [{ x: nose.x, y: nose.y }, shortNoseEnd], kind: "face" },
    {
      points: [
        { x: mouthLeft.x, y: mouthLeft.y },
        { x: mouthRight.x, y: mouthRight.y },
      ],
      kind: "face",
    },
  ];
}

function getUpperBodyTorsoPaths(landmarks: readonly BodyLandmark[]): PoseGuidancePath[] {
  const leftShoulder = landmarks[SHOULDER_LINE_PAIR[0]];
  const rightShoulder = landmarks[SHOULDER_LINE_PAIR[1]];
  if (!isRenderableLandmark(leftShoulder) || !isRenderableLandmark(rightShoulder)) return [];
  const shoulderLine = getPath(landmarks, SHOULDER_LINE_PAIR, "body");
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const shoulderWidth = Math.hypot(
    rightShoulder.x - leftShoulder.x,
    rightShoulder.y - leftShoulder.y,
  );
  const centerCueLength = Math.min(
    shoulderWidth * UPPER_BODY_CENTER_CUE_RATIO,
    UPPER_BODY_CENTER_CUE_MAX_LENGTH,
  );
  return [
    ...(shoulderLine ? [shoulderLine] : []),
    {
      points: [
        shoulderMidpoint,
        { x: shoulderMidpoint.x, y: shoulderMidpoint.y + centerCueLength },
      ],
      kind: "body",
    },
  ];
}

/** Returns only reviewed, display-only pose paths; it never adds markers or head geometry. */
export function getPoseGuidancePaths(
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
): PoseGuidancePath[] {
  if (!landmarks) return [];
  const style = POSE_GUIDANCE_STYLES[variant];
  const paths = ARM_CHAINS.flatMap((chain) => {
    const path = getPath(landmarks, chain, "body");
    return path ? [path] : [];
  });
  if (style.includesUpperBodyTorso) paths.push(...getUpperBodyTorsoPaths(landmarks));
  if (style.includesShoulderHip) {
    SHOULDER_HIP_PAIRS.forEach((pair) => {
      const path = getPath(landmarks, pair, "body");
      if (path) paths.push(path);
    });
  }
  return style.includesFace ? [...paths, ...getFacePaths(landmarks)] : paths;
}

export function getPoseGuidanceSegments(
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
): PoseGuidanceSegment[] {
  return getPoseGuidancePaths(landmarks, variant).flatMap(({ points }) =>
    points.slice(1).map((to, index) => ({ from: points[index], to })),
  );
}

function curveControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...from };
  const offset = Math.min(length * 0.08, 0.02);
  return {
    x: (from.x + to.x) / 2 - (dy / length) * offset,
    y: (from.y + to.y) / 2 + (dx / length) * offset,
  };
}

export type PoseGuidanceCurveSegment = PoseGuidanceSegment & {
  control: { x: number; y: number };
  kind: "body" | "face";
};

export function getPoseGuidanceCurveSegments(
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
): PoseGuidanceCurveSegment[] {
  return getPoseGuidancePaths(landmarks, variant).flatMap(({ points, kind }) =>
    points.slice(1).map((to, index) => {
      const from = points[index];
      return { from, control: curveControlPoint(from, to), to, kind };
    }),
  );
}

export function drawPoseGuidance(
  context: CanvasRenderingContext2D,
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
  width: number,
  height: number,
): number {
  const style = POSE_GUIDANCE_STYLES[variant];
  const paths = getPoseGuidancePaths(landmarks, variant);
  context.save();
  context.strokeStyle = POSE_GUIDANCE_COLOR;
  context.lineCap = "round";
  context.lineJoin = "round";
  paths.forEach(({ points, kind }) => {
    context.globalAlpha = kind === "face" ? style.faceOpacity : style.opacity;
    context.lineWidth = Math.max(
      1,
      (width / 180) * (kind === "face" ? style.faceStrokeWidth : style.strokeWidth),
    );
    context.beginPath();
    context.moveTo(points[0].x * width, points[0].y * height);
    points.slice(1).forEach((point, index) => {
      const from = points[index];
      const control = curveControlPoint(from, point);
      context.quadraticCurveTo(
        control.x * width,
        control.y * height,
        point.x * width,
        point.y * height,
      );
    });
    context.stroke();
  });
  context.restore();
  return paths.length;
}
