import type { BodyMovementFeatures } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";

export type TransformStage = 0 | 1 | 2 | 3;

export type BodyVisualModel = {
  direction: "lateral" | "upward" | "downward" | "neutral";
  directionVector: { x: number; y: number };
  repetitionCount: number;
  expansion: "expanding" | "contracting" | "steady";
  ending: "abrupt" | "gradual" | "continued" | "unknown";
  abstractPath: string;
};

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
  const repetitionCount = features.motionShape.repetition === "repeated" ? 3 : 1;
  const ending = features.endingBehavior;
  const center = { x: 160, y: 80 };
  const distance = expansion === "expanding" ? 58 : expansion === "contracting" ? 24 : 42;
  const end = {
    x: center.x + directionVector.x * distance,
    y: center.y + directionVector.y * distance,
  };
  const control = {
    x: center.x + directionVector.x * distance * 0.45 - directionVector.y * 26,
    y: center.y + directionVector.y * distance * 0.45 + directionVector.x * 26,
  };
  const abstractPath = `M ${center.x} ${center.y} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
  return {
    direction,
    directionVector,
    repetitionCount,
    expansion,
    ending,
    abstractPath,
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
