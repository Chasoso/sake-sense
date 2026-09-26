import { ArrowLeft } from "lucide-react";
import { extractGestureFeatures, type GestureStroke } from "../../domain/gesture";
import type { SyntheticWavePoint, VoiceFeatures } from "../../domain/voice";
import { ExpressionTransform } from "./ExpressionTransform";
import { ExperienceBrand } from "./ExperienceBrand";

export function VoiceProcessingScreen({
  features,
  waveHistory,
  onBack,
}: {
  features: VoiceFeatures;
  waveHistory: SyntheticWavePoint[];
  onBack: () => void;
}) {
  return (
    <main
      className="experience-screen experience-screen--voice-transform"
      aria-labelledby="voice-transform-title"
    >
      <nav className="experience-screen__nav" aria-label="画面の移動">
        <button className="icon-text-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>戻る</span>
        </button>
        <ExperienceBrand />
      </nav>
      <ExpressionTransform mode="voice" features={features} waveHistory={waveHistory} />
    </main>
  );
}

export function GestureProcessingScreen({
  strokes,
  onBack,
}: {
  strokes: GestureStroke[];
  onBack: () => void;
}) {
  return (
    <main
      className="experience-screen experience-screen--gesture-transform"
      aria-labelledby="gesture-transform-title"
    >
      <nav className="experience-screen__nav" aria-label="画面の移動">
        <button className="icon-text-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>戻る</span>
        </button>
        <ExperienceBrand />
      </nav>
      <ExpressionTransform
        mode="gesture"
        features={extractGestureFeatures(strokes)}
        strokes={strokes}
      />
    </main>
  );
}
