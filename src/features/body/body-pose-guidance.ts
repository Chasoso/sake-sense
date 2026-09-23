import type { BodyLandmark } from "../../domain/body";
import {
  BODY_POSE_ARM_CONNECTIONS,
  BODY_POSE_UPPER_BODY_CONNECTIONS,
  type BodyPoseConnection,
} from "./body-pose-connections";

export const POSE_GUIDANCE_VISIBILITY_THRESHOLD = 0.35;
export const POSE_GUIDANCE_COLOR = "#c9a96a";
export const BODY_HYBRID_CONTOUR_COLOR = "#ead7a0";
export const BODY_HYBRID_CONTOUR_STYLE = {
  outerGlowOpacity: 0.16,
  outerGlowWidthScale: 2.2,
  outerCoreOpacity: 0.86,
  outerCoreWidthScale: 1.1,
  outerCoreStrokeWidth: 1.4,
  innerOpacity: 0.58,
  innerWidthScale: 0.9,
  innerStrokeWidth: 1,
  glowBlurPx: 3,
} as const;

export type PoseGuidanceVariantId = "subtle-arms" | "subtle-arms-torso" | "subtle-arms-torso-face";

export type PoseGuidanceStyle = {
  id: PoseGuidanceVariantId;
  label: string;
  opacity: number;
  strokeWidth: number;
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
    includesUpperBodyTorso: false,
    includesFace: false,
    faceOpacity: 0,
    faceStrokeWidth: 0,
  },
  "subtle-arms-torso": {
    id: "subtle-arms-torso",
    label: "subtle arms + upper-body topology",
    opacity: 0.22,
    strokeWidth: 1.1,
    includesUpperBodyTorso: true,
    includesFace: false,
    faceOpacity: 0,
    faceStrokeWidth: 0,
  },
  "subtle-arms-torso-face": {
    id: "subtle-arms-torso-face",
    label: "subtle arms + torso + face direction",
    opacity: 0.18,
    strokeWidth: 1.25,
    includesUpperBodyTorso: true,
    includesFace: true,
    faceOpacity: 0.09,
    faceStrokeWidth: 0.85,
  },
};

export type PoseGuidanceSegment = {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type PoseGuidancePath = {
  points: Array<{ x: number; y: number }>;
  kind: "body" | "face";
};

function isRenderableBodyLandmark(landmark: BodyLandmark | undefined): boolean {
  return Boolean(landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y));
}

function isRenderableFaceLandmark(landmark: BodyLandmark | undefined): boolean {
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
  const isRenderable = kind === "face" ? isRenderableFaceLandmark : isRenderableBodyLandmark;
  if (points.some((landmark) => !isRenderable(landmark))) return null;
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
    !isRenderableFaceLandmark(nose) ||
    !isRenderableFaceLandmark(mouthLeft) ||
    !isRenderableFaceLandmark(mouthRight)
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

/** Returns only reviewed, display-only pose paths; it never adds markers or head geometry. */
export function getPoseGuidancePaths(
  landmarks: readonly BodyLandmark[] | null | undefined,
  variant: PoseGuidanceVariantId,
): PoseGuidancePath[] {
  if (!landmarks) return [];
  const style = POSE_GUIDANCE_STYLES[variant];
  const connectionSet = style.includesUpperBodyTorso
    ? BODY_POSE_UPPER_BODY_CONNECTIONS
    : BODY_POSE_ARM_CONNECTIONS;
  const paths = connectionSet.flatMap((connection: BodyPoseConnection) => {
    const path = getPath(landmarks, connection, "body");
    return path ? [path] : [];
  });
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

export type BodyHybridDisplaySnapshot = {
  outerContour: Array<{ x: number; y: number }>;
  innerContours: Array<Array<{ x: number; y: number }>>;
  poseCurves: PoseGuidanceCurveSegment[];
};

export type BodyHybridReplayFrame = {
  t: number;
  outerContour: Array<{ x: number; y: number }>;
  innerContours: Array<Array<{ x: number; y: number }>>;
};

function scaleContourPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } {
  return { x: (point.x / width) * 320, y: (point.y / height) * 160 };
}

function scalePosePoint(point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x * 320, y: point.y * 160 };
}

/** Creates only transient, normalized display geometry for live-to-waiting handoff. */
export function createBodyHybridDisplaySnapshot(
  outerContour: readonly { x: number; y: number }[],
  innerContours: readonly (readonly { x: number; y: number }[])[],
  landmarks: readonly BodyLandmark[] | null | undefined,
  maskWidth: number,
  maskHeight: number,
): BodyHybridDisplaySnapshot {
  const poseCurves = getPoseGuidanceCurveSegments(landmarks, "subtle-arms-torso-face").map(
    ({ from, control, to, kind }) => ({
      from: scalePosePoint(from),
      control: scalePosePoint(control),
      to: scalePosePoint(to),
      kind,
    }),
  );
  return {
    outerContour: outerContour.map((point) => scaleContourPoint(point, maskWidth, maskHeight)),
    innerContours: innerContours.map((contour) =>
      contour.map((point) => scaleContourPoint(point, maskWidth, maskHeight)),
    ),
    poseCurves,
  };
}

/** Creates one local, presentation-only contour frame for Body replay. */
export function createBodyHybridReplayFrame(
  t: number,
  outerContour: readonly { x: number; y: number }[],
  innerContours: readonly (readonly { x: number; y: number }[])[],
  maskWidth: number,
  maskHeight: number,
): BodyHybridReplayFrame {
  return {
    t,
    outerContour: outerContour.map((point) => scaleContourPoint(point, maskWidth, maskHeight)),
    innerContours: innerContours.map((contour) =>
      contour.map((point) => scaleContourPoint(point, maskWidth, maskHeight)),
    ),
  };
}

export function getBodyHybridReplayFrame(
  frames: readonly BodyHybridReplayFrame[],
  elapsedMs: number,
): BodyHybridReplayFrame | null {
  if (!frames.length || !Number.isFinite(elapsedMs)) return null;
  if (elapsedMs <= frames[0].t) return frames[0];
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    if (elapsedMs >= frames[index].t) return frames[index];
  }
  return frames[0];
}

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
