import type { BodyLandmark } from "../../domain/body";

export const HYBRID_POSE_MIN_VISIBILITY = 0.6;
export const HYBRID_GUIDE_OPACITY = 0.3;
export const HYBRID_GUIDE_LINE_WIDTH_SCALE = 0.5;

const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

export type HybridPoint = { x: number; y: number };

export type HybridArmGuide = {
  /** Ordered anatomical waypoints that the rendered guide must pass through. */
  points: HybridPoint[];
};

export type ArmGuideSegment = {
  start: HybridPoint;
  end: HybridPoint;
};

export type HybridHeadGuide = {
  center: HybridPoint;
  radiusX: number;
  radiusY: number;
};

export type UpperBodyPoseGuides = {
  leftArm: HybridArmGuide | null;
  rightArm: HybridArmGuide | null;
  shoulderLine: [HybridPoint, HybridPoint] | null;
  head: HybridHeadGuide | null;
  visibleLandmarkCount: number;
  validArmChainCount: number;
};

function visible(landmark: BodyLandmark | undefined): landmark is BodyLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= HYBRID_POSE_MIN_VISIBILITY);
}

function point(landmark: BodyLandmark): HybridPoint {
  return { x: landmark.x, y: landmark.y };
}

function armGuide(
  landmarks: BodyLandmark[],
  shoulderIndex: number,
  elbowIndex: number,
  wristIndex: number,
): HybridArmGuide | null {
  const shoulder = landmarks[shoulderIndex];
  const elbow = landmarks[elbowIndex];
  const wrist = landmarks[wristIndex];
  if (!visible(shoulder)) return null;
  if (visible(elbow) && visible(wrist)) {
    return { points: [point(shoulder), point(elbow), point(wrist)] };
  }
  if (visible(elbow)) return { points: [point(shoulder), point(elbow)] };
  return null;
}

function headGuide(landmarks: BodyLandmark[]): HybridHeadGuide | null {
  const nose = landmarks[NOSE];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  if (!visible(nose) || !visible(leftEar) || !visible(rightEar)) return null;
  const left = point(leftEar);
  const right = point(rightEar);
  const nosePoint = point(nose);
  return {
    center: {
      x: (left.x + right.x + nosePoint.x) / 3,
      y: (left.y + right.y + nosePoint.y) / 3,
    },
    radiusX: Math.max(Math.abs(right.x - left.x) * 0.65, 0.02),
    radiusY: Math.max(Math.abs(right.x - left.x) * 0.85, 0.03),
  };
}

/** Converts anatomical waypoints into pass-through segments without interpolation. */
export function buildArmGuideSegments(arm: HybridArmGuide): ArmGuideSegment[] {
  return arm.points.slice(0, -1).flatMap((start, index) => {
    const end = arm.points[index + 1];
    return end ? [{ start, end }] : [];
  });
}

/** Builds lightweight, visibility-filtered pose guidance without mutating landmarks. */
export function buildUpperBodyPoseGuides(
  landmarks: BodyLandmark[] | null | undefined,
): UpperBodyPoseGuides {
  if (!landmarks) {
    return {
      leftArm: null,
      rightArm: null,
      shoulderLine: null,
      head: null,
      visibleLandmarkCount: 0,
      validArmChainCount: 0,
    };
  }

  const relevantIndices = [
    NOSE,
    LEFT_EAR,
    RIGHT_EAR,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    LEFT_ELBOW,
    RIGHT_ELBOW,
    LEFT_WRIST,
    RIGHT_WRIST,
  ];
  const visibleLandmarkCount = relevantIndices.filter((index) => visible(landmarks[index])).length;
  const leftArm = armGuide(landmarks, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST);
  const rightArm = armGuide(landmarks, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];

  return {
    leftArm,
    rightArm,
    shoulderLine:
      visible(leftShoulder) && visible(rightShoulder)
        ? [point(leftShoulder), point(rightShoulder)]
        : null,
    head: headGuide(landmarks),
    visibleLandmarkCount,
    validArmChainCount: [leftArm, rightArm].filter((arm) => arm?.points.length === 3).length,
  };
}

function drawArmGuide(
  context: CanvasRenderingContext2D,
  arm: HybridArmGuide,
  width: number,
  height: number,
): void {
  const segments = buildArmGuideSegments(arm);
  context.beginPath();
  segments.forEach((segment, index) => {
    if (index === 0) {
      context.moveTo(segment.start.x * width, segment.start.y * height);
    }
    context.lineTo(segment.end.x * width, segment.end.y * height);
  });
  if (segments.length > 0) {
    context.stroke();
  }
}

/** Draws the quiet pose-reference layer; no landmark dots or skeleton fill are used. */
export function drawPoseGuides(
  context: CanvasRenderingContext2D,
  guides: UpperBodyPoseGuides | null,
  width: number,
  height: number,
  options: { clear?: boolean; color?: string; lineWidth?: number } = {},
): void {
  if (options.clear !== false) context.clearRect(0, 0, width, height);
  if (!guides) return;
  context.save();
  context.strokeStyle = options.color ?? `rgba(234, 215, 160, ${HYBRID_GUIDE_OPACITY})`;
  context.lineWidth = options.lineWidth ?? 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  if (guides.leftArm) drawArmGuide(context, guides.leftArm, width, height);
  if (guides.rightArm) drawArmGuide(context, guides.rightArm, width, height);
  if (guides.shoulderLine) {
    context.beginPath();
    context.moveTo(guides.shoulderLine[0].x * width, guides.shoulderLine[0].y * height);
    context.lineTo(guides.shoulderLine[1].x * width, guides.shoulderLine[1].y * height);
    context.stroke();
  }
  if (guides.head) {
    context.beginPath();
    context.ellipse(
      guides.head.center.x * width,
      guides.head.center.y * height,
      guides.head.radiusX * width,
      guides.head.radiusY * height,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }
  context.restore();
}
