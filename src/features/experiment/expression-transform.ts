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

export type BodySkeletonGeometry = {
  skeletonPath: string;
  skeletonSegments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>;
  skeletonPoints: Array<{ x: number; y: number }>;
  skeletonFrameIndex: number;
};

export const BODY_TRANSFORM_VISIBILITY_THRESHOLD = 0.35;

const SKELETON_LANDMARK_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [11, 1],
  [12, 1],
  [13, 1],
  [14, 1],
  [15, 3],
  [16, 3],
];

function pointForLandmark(frame: BodyPoseFrame, index: number): { x: number; y: number } | null {
  const landmark = frame.landmarks[index];
  if (!landmark || (landmark.visibility ?? 1) < BODY_TRANSFORM_VISIBILITY_THRESHOLD) return null;
  return { x: landmark.x * 320, y: landmark.y * 160 };
}

function frameVisibilityScore(frame: BodyPoseFrame): {
  score: number;
  wristCount: number;
  shoulderCount: number;
  visibleCount: number;
} {
  let score = 0;
  let wristCount = 0;
  let shoulderCount = 0;
  let visibleCount = 0;
  SKELETON_LANDMARK_WEIGHTS.forEach(([index, weight]) => {
    const visibility = frame.landmarks[index]?.visibility ?? 1;
    if (visibility < BODY_TRANSFORM_VISIBILITY_THRESHOLD) return;
    score += weight;
    visibleCount += 1;
    if (index === 15 || index === 16) wristCount += 1;
    if (index === 11 || index === 12) shoulderCount += 1;
  });
  return { score, wristCount, shoulderCount, visibleCount };
}

export function selectSkeletonFrameIndex(frames: BodyPoseFrame[]): number {
  if (!frames.length) return 0;
  const center = (frames.length - 1) / 2;
  const middleStart = Math.floor(frames.length * 0.25);
  const middleEnd = Math.max(middleStart + 1, Math.ceil(frames.length * 0.75));
  const middleCandidates = frames.map((_, index) => index).slice(middleStart, middleEnd);

  const chooseBest = (candidates: number[]): number | null => {
    const viable = candidates.filter((index) => {
      const quality = frameVisibilityScore(frames[index]);
      return quality.shoulderCount > 0 && quality.visibleCount >= 2;
    });
    if (!viable.length) return null;
    return viable.sort((left, right) => {
      const leftQuality = frameVisibilityScore(frames[left]);
      const rightQuality = frameVisibilityScore(frames[right]);
      return (
        rightQuality.wristCount - leftQuality.wristCount ||
        rightQuality.score - leftQuality.score ||
        Math.abs(left - center) - Math.abs(right - center) ||
        left - right
      );
    })[0];
  };

  return (
    chooseBest(middleCandidates) ??
    chooseBest(frames.map((_, index) => index)) ??
    Math.floor(center)
  );
}

export function getBodySkeletonGeometry(frames: BodyPoseFrame[]): BodySkeletonGeometry {
  const skeletonPoints: Array<{ x: number; y: number }> = [];
  const skeletonSegments: string[] = [];
  const segmentPoints: BodySkeletonGeometry["skeletonSegments"] = [];

  const skeletonFrameIndex = selectSkeletonFrameIndex(frames);
  const skeletonFrame = frames[skeletonFrameIndex];
  if (skeletonFrame) {
    [11, 12, 13, 14, 15, 16].forEach((index) => {
      const point = pointForLandmark(skeletonFrame, index);
      if (point) skeletonPoints.push(point);
    });
    const point = (index: number) => pointForLandmark(skeletonFrame, index);
    const connect = (from: number, to: number) => {
      const start = point(from);
      const end = point(to);
      if (start && end) {
        segmentPoints.push({ start, end });
        skeletonSegments.push(
          `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
        );
      }
    };
    connect(11, 12);
    connect(11, 13);
    connect(13, 15);
    connect(12, 14);
    connect(14, 16);
  }

  return {
    skeletonPath: skeletonSegments.join(" ") || "M 120 48 L 200 48 M 160 48 L 160 116",
    skeletonSegments:
      segmentPoints.length > 0
        ? segmentPoints
        : [
            { start: { x: 120, y: 48 }, end: { x: 200, y: 48 } },
            { start: { x: 160, y: 48 }, end: { x: 160, y: 116 } },
          ],
    skeletonPoints,
    skeletonFrameIndex,
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

export const BODY_TRANSFORM_DURATION_MS = 2000;

export function getBodyTransformProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(elapsedMs / BODY_TRANSFORM_DURATION_MS, 1);
}

export function getBodyDissolveProgress(progress: number): number {
  return windowProgress(progress, 0.12, 0.9);
}

export function getBodyLightProgress(progress: number): number {
  return windowProgress(progress, 0.05, 0.72);
}

export function getBodyProcessingDots(elapsedMs: number): string {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(elapsedMs, 0) : 0;
  return ".".repeat((Math.floor(safeElapsed / 500) % 3) + 1);
}

export function getBodyDissolveOpacity(progress: number): number {
  return 1 - getBodyDissolveProgress(progress);
}

export function getBodyAbsorbedPoint(
  point: { x: number; y: number },
  progress: number,
): { x: number; y: number } {
  const absorption = getBodyDissolveProgress(progress);
  const centerX = 160;
  const centerY = 80;
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  const radius = Math.hypot(deltaX, deltaY);
  const radialFactor = Math.min(radius / 150, 1);
  const angle = Math.atan2(deltaY, deltaX) + absorption * (0.04 + radialFactor * 0.12);
  const radiusScale = 1 - absorption * (0.68 + radialFactor * 0.22);
  return {
    x: centerX + Math.cos(angle) * radius * radiusScale,
    y: centerY + Math.sin(angle) * radius * radiusScale,
  };
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

export function getBodyDisplayWords(features: BodyMovementFeatures): string[] {
  const words: string[] = [];
  const { motionShape } = features;
  const append = (word: string | null) => {
    if (word && !words.includes(word)) words.push(word);
  };
  if (motionShape.expansion === "expanding") append("広がる");
  if (motionShape.expansion === "contracting") append("まとまる");
  if (motionShape.dominantDirection === "lateral") append("横へ");
  if (motionShape.dominantDirection === "upward") append("上へ");
  if (motionShape.dominantDirection === "downward") append("下へ");
  if (motionShape.repetition === "repeated") append("くり返す");
  if (features.endingBehavior === "gradual") append("ゆっくり消える");
  if (features.endingBehavior === "abrupt") append("すっと止まる");
  if (features.endingBehavior === "continued") append("続く");
  return words.slice(0, 4);
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
