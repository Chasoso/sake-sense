import type { BodyMovementFeatures } from "../../domain/body";
import type { VoiceFeatures } from "../../domain/voice";

export type TransformStage = 0 | 1 | 2 | 3;

export function getTransformStage(elapsedMs: number): TransformStage {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 1500) return 0;
  if (elapsedMs < 3000) return 1;
  if (elapsedMs < 4500) return 2;
  return 3;
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
