import type { BodyMovementFeatures, BodyPoseFrame } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";

export type TransformStage = 0 | 1 | 2 | 3;

export type BodyVisualModel = {
  direction: "lateral" | "upward" | "downward" | "neutral";
  directionVector: { x: number; y: number };
  expansion: "expanding" | "contracting" | "steady";
  ending: "abrupt" | "gradual" | "continued" | "unknown";
  trailSpread: number;
  echoStrength: number;
  endingFade: number;
  softOffset: { x: number; y: number };
};

export type BodyTrailGeometry = {
  skeletonPath: string;
  skeletonPoints: Array<{ x: number; y: number }>;
  primaryPath: string;
  leftWristPath: string;
  rightWristPath: string;
  centerPath: string;
};

export const BODY_TRANSFORM_VISIBILITY_THRESHOLD = 0.35;

function pointForLandmark(frame: BodyPoseFrame, index: number): { x: number; y: number } | null {
  const landmark = frame.landmarks[index];
  if (!landmark || (landmark.visibility ?? 1) < BODY_TRANSFORM_VISIBILITY_THRESHOLD) return null;
  return { x: landmark.x * 320, y: landmark.y * 160 };
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "M 160 80";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    path += ` Q ${point.x.toFixed(1)} ${point.y.toFixed(1)} ${midpoint.x.toFixed(1)} ${midpoint.y.toFixed(1)}`;
  }
  const last = points.at(-1)!;
  path += ` Q ${last.x.toFixed(1)} ${last.y.toFixed(1)} ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return path;
}

export function getBodyTrailGeometry(frames: BodyPoseFrame[]): BodyTrailGeometry {
  const leftWrist: Array<{ x: number; y: number }> = [];
  const rightWrist: Array<{ x: number; y: number }> = [];
  const center: Array<{ x: number; y: number }> = [];
  const primary: Array<{ x: number; y: number }> = [];
  const skeletonPoints: Array<{ x: number; y: number }> = [];
  const skeletonSegments: string[] = [];

  const skeletonFrame = frames[Math.floor(frames.length / 2)] ?? frames[0];
  if (skeletonFrame) {
    [11, 12, 13, 14, 15, 16].forEach((index) => {
      const point = pointForLandmark(skeletonFrame, index);
      if (point) skeletonPoints.push(point);
    });
    const point = (index: number) => pointForLandmark(skeletonFrame, index);
    const connect = (from: number, to: number) => {
      const start = point(from);
      const end = point(to);
      if (start && end)
        skeletonSegments.push(
          `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
        );
    };
    connect(11, 12);
    connect(11, 13);
    connect(13, 15);
    connect(12, 14);
    connect(14, 16);
  }

  frames.forEach((frame) => {
    const left = pointForLandmark(frame, 15);
    const right = pointForLandmark(frame, 16);
    const shoulders = [pointForLandmark(frame, 11), pointForLandmark(frame, 12)].filter(
      (point): point is { x: number; y: number } => point !== null,
    );
    if (left) leftWrist.push(left);
    if (right) rightWrist.push(right);
    if (shoulders.length) {
      const shoulderCenter = shoulders.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      center.push({
        x: shoulderCenter.x / shoulders.length,
        y: shoulderCenter.y / shoulders.length,
      });
    }
    if (left && right) primary.push({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 });
    else if (left ?? right) primary.push(left ?? right!);
  });

  return {
    skeletonPath: skeletonSegments.join(" ") || "M 120 48 L 200 48 M 160 48 L 160 116",
    skeletonPoints,
    primaryPath: smoothPath(primary),
    leftWristPath: smoothPath(leftWrist),
    rightWristPath: smoothPath(rightWrist),
    centerPath: smoothPath(center),
  };
}

export function windowProgress(progress: number, start: number, end: number): number {
  if (end <= start) return progress >= end ? 1 : 0;
  const normalized = Math.min(Math.max((progress - start) / (end - start), 0), 1);
  return normalized * normalized * (3 - 2 * normalized);
}

export function getTransformProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(elapsedMs / 5200, 1);
}

export function getTransformStage(elapsedMs: number): TransformStage {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 1500) return 0;
  if (elapsedMs < 3000) return 1;
  if (elapsedMs < 4500) return 2;
  return 3;
}

export function getBodyVisualModel(features: BodyMovementFeatures): BodyVisualModel {
  const direction =
    features.motionShape.dominantDirection === "unknown"
      ? "neutral"
      : features.motionShape.dominantDirection;
  const directionVector =
    direction === "lateral"
      ? { x: 1, y: 0 }
      : direction === "upward"
        ? { x: 0, y: -1 }
        : direction === "downward"
          ? { x: 0, y: 1 }
          : { x: 0.7, y: -0.2 };
  const expansion =
    features.motionShape.expansion === "unknown" ? "steady" : features.motionShape.expansion;
  const ending = features.endingBehavior;
  const trailSpread = expansion === "expanding" ? 1.08 : expansion === "contracting" ? 0.94 : 1;
  const echoStrength = features.motionShape.repetition === "repeated" ? 0.18 : 0.06;
  const endingFade = ending === "abrupt" ? 0.72 : ending === "gradual" ? 0.42 : 0.18;
  const softOffset = { x: directionVector.x * 4, y: directionVector.y * 4 };
  return {
    direction,
    directionVector,
    expansion,
    ending,
    trailSpread,
    echoStrength,
    endingFade,
    softOffset,
  };
}

function appendUnique(words: string[], word: string | null): void {
  if (word && !words.includes(word)) words.push(word);
}

export function getBodyIntermediateWords(features: BodyMovementFeatures): string[] {
  const words: string[] = [];
  const { motionShape } = features;
  appendUnique(
    words,
    motionShape.dominantDirection === "lateral"
      ? "横へ"
      : motionShape.dominantDirection === "upward"
        ? "上へ"
        : motionShape.dominantDirection === "downward"
          ? "下へ"
          : null,
  );
  appendUnique(words, motionShape.repetition === "repeated" ? "くり返す" : null);
  appendUnique(
    words,
    motionShape.expansion === "expanding"
      ? "広がる"
      : motionShape.expansion === "contracting"
        ? "まとまる"
        : null,
  );
  appendUnique(
    words,
    features.endingBehavior === "gradual"
      ? "ゆっくり消える"
      : features.endingBehavior === "abrupt"
        ? "すっと止まる"
        : features.endingBehavior === "continued"
          ? "続く"
          : null,
  );
  return words.length ? words : ["動きの輪郭"];
}

export function getVoiceIntermediateWords(features: VoiceFeatures): string[] {
  const words: string[] = [];
  if (features.averageIntensity >= 0.35) appendUnique(words, "大きく");
  else if (features.averageIntensity > 0) appendUnique(words, "小さく");
  if (features.durationMs >= 1500) appendUnique(words, "長く");
  else if (features.durationMs > 0) appendUnique(words, "短く");
  if (features.pauseCount > 0) appendUnique(words, "間をあけて");
  appendUnique(
    words,
    features.endingBehavior === "fading"
      ? "ゆっくり消える"
      : features.endingBehavior === "maintained"
        ? "続く"
        : null,
  );
  return words.length ? words : ["声の輪郭"];
}
