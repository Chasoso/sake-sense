import type { BodyLandmark } from "../../domain/body";
import type { BinaryMask, Contour } from "./segmentation-mask-spike";

export const HYBRID_POSE_MIN_VISIBILITY = 0.6;
export const HYBRID_GUIDE_OPACITY = 0.3;
export const HYBRID_GUIDE_LINE_WIDTH_SCALE = 0.5;
/** Reference raster dimensions used to scale display-only pixel widths. */
export const HYBRID_REFERENCE_SOURCE_WIDTH = 320;
export const HYBRID_REFERENCE_SOURCE_HEIGHT = 180;
export const HYBRID_UPPER_ARM_HALF_WIDTH_PX = 8;
export const HYBRID_FOREARM_HALF_WIDTH_PX = 6;
export const HYBRID_OUTER_CONTOUR_SUPPRESSION_DISTANCE_PX = 5;
export const HYBRID_INTERNAL_BOUNDARY_OPACITY = 0.45;
export const HYBRID_INTERNAL_BOUNDARY_LINE_WIDTH_SCALE = 0.6;

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

export type InternalBoundarySegment = ArmGuideSegment;

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

function offsetSegment(
  segment: ArmGuideSegment,
  halfWidthPx: number,
  sourceWidth: number,
  sourceHeight: number,
): InternalBoundarySegment[] {
  const startPx = { x: segment.start.x * sourceWidth, y: segment.start.y * sourceHeight };
  const endPx = { x: segment.end.x * sourceWidth, y: segment.end.y * sourceHeight };
  const dx = endPx.x - startPx.x;
  const dy = endPx.y - startPx.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const normal = { x: -dy / length, y: dx / length };
  return [-1, 1].map((side) => ({
    start: {
      x: (startPx.x + normal.x * halfWidthPx * side) / sourceWidth,
      y: (startPx.y + normal.y * halfWidthPx * side) / sourceHeight,
    },
    end: {
      x: (endPx.x + normal.x * halfWidthPx * side) / sourceWidth,
      y: (endPx.y + normal.y * halfWidthPx * side) / sourceHeight,
    },
  }));
}

function referencePixelScale(sourceWidth: number, sourceHeight: number): number {
  return Math.min(
    sourceWidth / HYBRID_REFERENCE_SOURCE_WIDTH,
    sourceHeight / HYBRID_REFERENCE_SOURCE_HEIGHT,
  );
}

/** Creates both sides of each arm segment; these are candidates, not visible guides. */
export function buildArmBoundaryCandidates(
  arm: HybridArmGuide | null,
  sourceWidth: number,
  sourceHeight: number,
): InternalBoundarySegment[] {
  if (!arm || sourceWidth <= 0 || sourceHeight <= 0) return [];
  const scale = referencePixelScale(sourceWidth, sourceHeight);
  return buildArmGuideSegments(arm).flatMap((segment, index) =>
    offsetSegment(
      segment,
      (index === 0 ? HYBRID_UPPER_ARM_HALF_WIDTH_PX : HYBRID_FOREARM_HALF_WIDTH_PX) * scale,
      sourceWidth,
      sourceHeight,
    ),
  );
}

function sampleSegment(segment: InternalBoundarySegment, sampleCount = 8): HybridPoint[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const ratio = index / sampleCount;
    return {
      x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
      y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
    };
  });
}

function splitByPredicate(
  segments: InternalBoundarySegment[],
  predicate: (point: HybridPoint) => boolean,
): InternalBoundarySegment[] {
  return segments.flatMap((segment) => {
    const retained: InternalBoundarySegment[] = [];
    let runStart: HybridPoint | null = null;
    let previous: HybridPoint | null = null;
    sampleSegment(segment).forEach((point) => {
      if (!predicate(point)) {
        if (runStart && previous && runStart !== previous) {
          retained.push({ start: runStart, end: previous });
        }
        runStart = null;
        previous = null;
        return;
      }
      runStart ??= point;
      previous = point;
    });
    if (runStart && previous && runStart !== previous) {
      retained.push({ start: runStart, end: previous });
    }
    return retained;
  });
}

function maskContains(mask: BinaryMask, point: HybridPoint): boolean {
  if (point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1) return false;
  const x = Math.min(mask.width - 1, Math.floor(point.x * mask.width));
  const y = Math.min(mask.height - 1, Math.floor(point.y * mask.height));
  return mask.data[y * mask.width + x] === 1;
}

/** Removes candidate portions that leave the current primary-person mask. */
export function filterBoundaryToPersonMask(
  candidates: InternalBoundarySegment[],
  mask: BinaryMask | null,
): InternalBoundarySegment[] {
  if (!mask) return [];
  return splitByPredicate(candidates, (point) => maskContains(mask, point));
}

function distanceToContourPx(
  point: HybridPoint,
  contour: Contour,
  width: number,
  height: number,
): number {
  const pointPx = { x: point.x * width, y: point.y * height };
  return contour.reduce((minimum, contourPoint, index) => {
    const nextPoint = contour[(index + 1) % contour.length];
    const start = contourPoint;
    const end = nextPoint;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const projection =
      lengthSquared === 0
        ? 0
        : Math.min(
            Math.max(((pointPx.x - start.x) * dx + (pointPx.y - start.y) * dy) / lengthSquared, 0),
            1,
          );
    return Math.min(
      minimum,
      Math.hypot(pointPx.x - (start.x + dx * projection), pointPx.y - (start.y + dy * projection)),
    );
  }, Number.POSITIVE_INFINITY);
}

/** Suppresses only portions that remain close to the already-visible outer edge. */
export function suppressBoundaryNearOuterContour(
  candidates: InternalBoundarySegment[],
  outerContour: Contour | null,
  sourceWidth: number,
  sourceHeight: number,
  suppressionDistancePx = HYBRID_OUTER_CONTOUR_SUPPRESSION_DISTANCE_PX,
): InternalBoundarySegment[] {
  if (!outerContour || outerContour.length === 0) return candidates.slice();
  const suppressionDistance =
    suppressionDistancePx * referencePixelScale(sourceWidth, sourceHeight);
  return splitByPredicate(
    candidates,
    (point) =>
      distanceToContourPx(point, outerContour, sourceWidth, sourceHeight) >= suppressionDistance,
  );
}

/** Builds the display-only internal arm separation from pose and segmentation evidence. */
export function buildInternalBodyBoundaries(
  guides: UpperBodyPoseGuides | null,
  mask: BinaryMask | null,
  outerContour: Contour | null,
): InternalBoundarySegment[] {
  if (!guides || !mask || !outerContour) return [];
  const candidates = [
    ...buildArmBoundaryCandidates(guides.leftArm, mask.width, mask.height),
    ...buildArmBoundaryCandidates(guides.rightArm, mask.width, mask.height),
  ];
  return suppressBoundaryNearOuterContour(
    filterBoundaryToPersonMask(candidates, mask),
    outerContour,
    mask.width,
    mask.height,
  );
}

export function drawInternalBodyBoundaries(
  context: CanvasRenderingContext2D,
  segments: InternalBoundarySegment[],
  width: number,
  height: number,
  options: { color?: string; lineWidth?: number } = {},
): void {
  context.save();
  context.strokeStyle = options.color ?? `rgba(234, 215, 160, ${HYBRID_INTERNAL_BOUNDARY_OPACITY})`;
  context.lineWidth = options.lineWidth ?? 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  segments.forEach((segment) => {
    context.beginPath();
    context.moveTo(segment.start.x * width, segment.start.y * height);
    context.lineTo(segment.end.x * width, segment.end.y * height);
    context.stroke();
  });
  context.restore();
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
