import type { BodyLandmark } from "../../domain/body";

export const BODY_RENDER_VISIBILITY_THRESHOLD = 0.35;

export type BodyPoint = { x: number; y: number };

export type ContourPath = {
  points: BodyPoint[];
  closed: true;
};

export type BodyContourGeometry = {
  head: ContourPath | null;
  neck: ContourPath | null;
  torso: ContourPath | null;
  leftArm: ContourPath | null;
  rightArm: ContourPath | null;
  leftLeg: ContourPath | null;
  rightLeg: ContourPath | null;
  leftFoot: ContourPath | null;
  rightFoot: ContourPath | null;
};

export const UPPER_ARM_WIDTH_RATIO = 0.11;
export const ELBOW_WIDTH_RATIO = 0.075;
export const FOREARM_WIDTH_RATIO = 0.09;
export const WRIST_WIDTH_RATIO = 0.055;
export const THIGH_WIDTH_RATIO = 0.19;
export const KNEE_WIDTH_RATIO = 0.13;
export const CALF_WIDTH_RATIO = 0.14;
export const ANKLE_WIDTH_RATIO = 0.075;

function visiblePoint(landmarks: BodyLandmark[], index: number): BodyPoint | null {
  const landmark = landmarks[index];
  if (!landmark || (landmark.visibility ?? 1) < BODY_RENDER_VISIBILITY_THRESHOLD) return null;
  return { x: landmark.x, y: landmark.y };
}

function distance(a: BodyPoint, b: BodyPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(vector: BodyPoint): BodyPoint {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 1 };
}

function add(a: BodyPoint, b: BodyPoint): BodyPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(point: BodyPoint, amount: number): BodyPoint {
  return { x: point.x * amount, y: point.y * amount };
}

function midpoint(a: BodyPoint, b: BodyPoint): BodyPoint {
  return scale(add(a, b), 0.5);
}

function interpolate(a: BodyPoint, b: BodyPoint, amount: number): BodyPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function offset(point: BodyPoint, direction: BodyPoint, amount: number): BodyPoint {
  return add(point, scale(direction, amount));
}

function sideNormal(a: BodyPoint, b: BodyPoint): BodyPoint {
  return normalize({ x: -(b.y - a.y), y: b.x - a.x });
}

function averagedNormal(points: BodyPoint[], index: number): BodyPoint {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  return sideNormal(previous, next);
}

function contour(points: BodyPoint[]): ContourPath | null {
  return points.length >= 3 ? { points, closed: true } : null;
}

/** Builds a closed, softly tapered outer shell around a center-line. */
export function buildLimbContour(
  centerLine: BodyPoint[],
  widths: number[],
  terminal?: BodyPoint,
): ContourPath | null {
  if (centerLine.length < 2 || centerLine.length !== widths.length) return null;
  const normals = centerLine.map((_, index) => averagedNormal(centerLine, index));
  const outer = centerLine.map((point, index) => offset(point, normals[index], widths[index] / 2));
  const inner = centerLine
    .map((point, index) => offset(point, normals[index], -widths[index] / 2))
    .reverse();
  const points = terminal ? [...outer, terminal, ...inner] : [...outer, ...inner];
  return contour(points);
}

function ellipseContour(center: BodyPoint, radiusX: number, radiusY: number): ContourPath {
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 12;
    return { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY };
  });
  return { points, closed: true };
}

function buildTorso(
  leftShoulder: BodyPoint,
  rightShoulder: BodyPoint,
  leftHip: BodyPoint,
  rightHip: BodyPoint,
): ContourPath {
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const horizontal = normalize({
    x: rightShoulder.x - leftShoulder.x,
    y: rightShoulder.y - leftShoulder.y,
  });
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const chestCenter = {
    x: shoulderCenter.x + (hipCenter.x - shoulderCenter.x) * 0.28,
    y: shoulderCenter.y + (hipCenter.y - shoulderCenter.y) * 0.28,
  };
  const waistCenter = {
    x: shoulderCenter.x + (hipCenter.x - shoulderCenter.x) * 0.68,
    y: shoulderCenter.y + (hipCenter.y - shoulderCenter.y) * 0.68,
  };
  const chestHalfWidth = shoulderWidth * 0.48;
  const waistHalfWidth = shoulderWidth * 0.32;
  const left = [
    leftShoulder,
    offset(chestCenter, horizontal, -chestHalfWidth),
    offset(waistCenter, horizontal, -waistHalfWidth),
    leftHip,
  ];
  const right = [
    rightShoulder,
    offset(chestCenter, horizontal, chestHalfWidth),
    offset(waistCenter, horizontal, waistHalfWidth),
    rightHip,
  ];
  return { points: [...left, ...right.reverse()], closed: true };
}

function buildNeck(
  headBottom: BodyPoint,
  shoulderCenter: BodyPoint,
  scaleValue: number,
): ContourPath {
  const down = normalize({
    x: shoulderCenter.x - headBottom.x,
    y: shoulderCenter.y - headBottom.y,
  });
  const normal = { x: -down.y, y: down.x };
  const neckTop = offset(headBottom, down, scaleValue * 0.02);
  const neckBottom = offset(shoulderCenter, down, -scaleValue * 0.08);
  const halfWidth = scaleValue * 0.13;
  return {
    points: [
      offset(neckTop, normal, halfWidth),
      offset(neckBottom, normal, halfWidth * 1.15),
      offset(neckBottom, normal, -halfWidth * 1.15),
      offset(neckTop, normal, -halfWidth),
    ],
    closed: true,
  };
}

function buildFoot(ankle: BodyPoint, knee: BodyPoint, width: number): ContourPath {
  const forward = normalize({ x: ankle.x - knee.x, y: ankle.y - knee.y });
  const normal = { x: -forward.y, y: forward.x };
  const toe = add(ankle, scale(forward, width * 1.8));
  return {
    points: [
      offset(ankle, normal, width / 2),
      offset(toe, normal, width * 0.55),
      add(toe, scale(forward, width * 0.35)),
      offset(toe, normal, -width * 0.55),
      offset(ankle, normal, -width / 2),
    ],
    closed: true,
  };
}

export function getBodyContourGeometry(landmarks: BodyLandmark[]): BodyContourGeometry {
  const leftShoulder = visiblePoint(landmarks, 11);
  const rightShoulder = visiblePoint(landmarks, 12);
  const leftElbow = visiblePoint(landmarks, 13);
  const rightElbow = visiblePoint(landmarks, 14);
  const leftWrist = visiblePoint(landmarks, 15);
  const rightWrist = visiblePoint(landmarks, 16);
  const leftHip = visiblePoint(landmarks, 23);
  const rightHip = visiblePoint(landmarks, 24);
  const leftKnee = visiblePoint(landmarks, 25);
  const rightKnee = visiblePoint(landmarks, 26);
  const leftAnkle = visiblePoint(landmarks, 27);
  const rightAnkle = visiblePoint(landmarks, 28);
  const nose = visiblePoint(landmarks, 0);
  const leftEar = visiblePoint(landmarks, 7);
  const rightEar = visiblePoint(landmarks, 8);

  const shoulderWidth = leftShoulder && rightShoulder ? distance(leftShoulder, rightShoulder) : 0;
  const scaleValue = shoulderWidth || (leftHip && rightHip ? distance(leftHip, rightHip) : 0.2);
  const shoulderCenter =
    leftShoulder && rightShoulder ? midpoint(leftShoulder, rightShoulder) : null;
  const headCenter =
    leftEar && rightEar && nose
      ? { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 - shoulderWidth * 0.08 }
      : null;
  const headRadius = leftEar && rightEar ? distance(leftEar, rightEar) * 0.58 : 0;
  const head =
    headCenter && headRadius > 0 ? ellipseContour(headCenter, headRadius, headRadius * 1.32) : null;
  const headBottom =
    headCenter && headRadius > 0 ? { x: headCenter.x, y: headCenter.y + headRadius * 1.32 } : null;

  return {
    head,
    neck: headBottom && shoulderCenter ? buildNeck(headBottom, shoulderCenter, scaleValue) : null,
    torso:
      leftShoulder && rightShoulder && leftHip && rightHip
        ? buildTorso(leftShoulder, rightShoulder, leftHip, rightHip)
        : null,
    leftArm:
      leftShoulder && leftElbow && leftWrist
        ? buildLimbContour(
            [leftShoulder, leftElbow, interpolate(leftElbow, leftWrist, 0.52), leftWrist],
            [
              scaleValue * UPPER_ARM_WIDTH_RATIO,
              scaleValue * ELBOW_WIDTH_RATIO,
              scaleValue * FOREARM_WIDTH_RATIO,
              scaleValue * WRIST_WIDTH_RATIO,
            ],
          )
        : null,
    rightArm:
      rightShoulder && rightElbow && rightWrist
        ? buildLimbContour(
            [rightShoulder, rightElbow, interpolate(rightElbow, rightWrist, 0.52), rightWrist],
            [
              scaleValue * UPPER_ARM_WIDTH_RATIO,
              scaleValue * ELBOW_WIDTH_RATIO,
              scaleValue * FOREARM_WIDTH_RATIO,
              scaleValue * WRIST_WIDTH_RATIO,
            ],
          )
        : null,
    leftLeg:
      leftHip && leftKnee && leftAnkle
        ? buildLimbContour(
            [leftHip, leftKnee, interpolate(leftKnee, leftAnkle, 0.52), leftAnkle],
            [
              scaleValue * THIGH_WIDTH_RATIO,
              scaleValue * KNEE_WIDTH_RATIO,
              scaleValue * CALF_WIDTH_RATIO,
              scaleValue * ANKLE_WIDTH_RATIO,
            ],
          )
        : null,
    rightLeg:
      rightHip && rightKnee && rightAnkle
        ? buildLimbContour(
            [rightHip, rightKnee, interpolate(rightKnee, rightAnkle, 0.52), rightAnkle],
            [
              scaleValue * THIGH_WIDTH_RATIO,
              scaleValue * KNEE_WIDTH_RATIO,
              scaleValue * CALF_WIDTH_RATIO,
              scaleValue * ANKLE_WIDTH_RATIO,
            ],
          )
        : null,
    leftFoot:
      leftAnkle && leftKnee ? buildFoot(leftAnkle, leftKnee, scaleValue * ANKLE_WIDTH_RATIO) : null,
    rightFoot:
      rightAnkle && rightKnee
        ? buildFoot(rightAnkle, rightKnee, scaleValue * ANKLE_WIDTH_RATIO)
        : null,
  };
}

export function contourPathToSvgPath(path: ContourPath, width: number, height: number): string {
  const points = path.points.map((point) => ({ x: point.x * width, y: point.y * height }));
  if (!points.length) return "";
  let result = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const midpointPoint = midpoint(previous, point);
    result += ` Q ${previous.x.toFixed(1)} ${previous.y.toFixed(1)} ${midpointPoint.x.toFixed(1)} ${midpointPoint.y.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  const first = points[0];
  const closingMidpoint = midpoint(last, first);
  result += ` Q ${last.x.toFixed(1)} ${last.y.toFixed(1)} ${closingMidpoint.x.toFixed(1)} ${closingMidpoint.y.toFixed(1)} Q ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${first.x.toFixed(1)} ${first.y.toFixed(1)} Z`;
  return result;
}

export function contourPathToCanvas(
  context: CanvasRenderingContext2D,
  path: ContourPath,
  width: number,
  height: number,
): void {
  const points = path.points.map((point) => ({ x: point.x * width, y: point.y * height }));
  if (!points.length) return;
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const middle = midpoint(previous, point);
    context.quadraticCurveTo(previous.x, previous.y, middle.x, middle.y);
  }
  const last = points.at(-1)!;
  const first = points[0];
  const middle = midpoint(last, first);
  context.quadraticCurveTo(last.x, last.y, middle.x, middle.y);
  context.quadraticCurveTo(first.x, first.y, first.x, first.y);
  context.closePath();
}
