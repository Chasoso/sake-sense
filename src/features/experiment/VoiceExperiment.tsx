import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, RotateCcw } from "lucide-react";
import {
  runLocalExperiment,
  runVoiceSemanticExperiment,
  type ExperimentResult,
} from "../../domain/experiment";
import {
  appendWaveHistory,
  advanceWavePhase,
  createSyntheticWavePath,
  estimatePitch,
  extractVoiceFeatures,
  mapPitchToWaveFrequency,
  smoothWaveValue,
  type SyntheticWavePoint,
  type VoiceFeatures,
  type VoiceSample,
} from "../../domain/voice";
import {
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
} from "../../domain/sensory-bridge";
import { ExpressionTransform } from "./ExpressionTransform";
import { Result } from "./Experiment";
import { ExperienceBrand } from "./ExperienceBrand";

export function VoiceExperiment({ onBack }: { onBack?: () => void } = {}) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "recording" | "captured" | "unavailable" | "denied"
  >("idle");
  const [voiceFeatures, setVoiceFeatures] = useState<VoiceFeatures | null>(null);
  const [waveHistory, setWaveHistory] = useState<SyntheticWavePoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const voiceStream = useRef<MediaStream | null>(null);
  const voiceContext = useRef<AudioContext | null>(null);
  const voiceAnalyser = useRef<AnalyserNode | null>(null);
  const voiceSamples = useRef<VoiceSample[]>([]);
  const voiceFirstFrame = useRef<number | null>(null);
  const voiceElapsed = useRef(0);
  const voiceFrame = useRef<number | null>(null);
  const wavePhase = useRef(0);
  const waveAmplitude = useRef(0);
  const waveFrequency = useRef(mapPitchToWaveFrequency(null));
  const waveLastTimestamp = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (voiceFrame.current !== null) cancelAnimationFrame(voiceFrame.current);
      voiceStream.current?.getTracks().forEach((track) => track.stop());
      void voiceContext.current?.close();
    },
    [],
  );

  const sampleVoice = (timestamp: number) => {
    const analyser = voiceAnalyser.current;
    if (!analyser) return;
    if (voiceFirstFrame.current === null) voiceFirstFrame.current = timestamp;
    voiceElapsed.current = Math.max(timestamp - voiceFirstFrame.current, 0);
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const level = Math.sqrt(
      data.reduce((total, value) => total + ((value - 128) / 128) ** 2, 0) / data.length,
    );
    const pitch = estimatePitch(data, voiceContext.current?.sampleRate ?? 0);
    const targetAmplitude = Math.min(level * 2.4, 1);
    const targetFrequency = mapPitchToWaveFrequency(pitch);
    const elapsedSinceLastFrame =
      waveLastTimestamp.current === null ? 0 : timestamp - waveLastTimestamp.current;
    waveLastTimestamp.current = timestamp;
    waveAmplitude.current = smoothWaveValue(waveAmplitude.current, targetAmplitude);
    waveFrequency.current = smoothWaveValue(waveFrequency.current, targetFrequency);
    wavePhase.current = advanceWavePhase(
      wavePhase.current,
      waveFrequency.current,
      elapsedSinceLastFrame,
    );
    setWaveHistory((current) =>
      appendWaveHistory(current, {
        amplitude: waveAmplitude.current,
        frequency: waveFrequency.current,
        phase: wavePhase.current,
      }),
    );
    voiceSamples.current.push({ t: voiceElapsed.current, level });
    voiceFrame.current = requestAnimationFrame(sampleVoice);
  };

  const stopVoice = () => {
    if (voiceFrame.current !== null) cancelAnimationFrame(voiceFrame.current);
    voiceFrame.current = null;
    voiceStream.current?.getTracks().forEach((track) => track.stop());
    voiceStream.current = null;
    const context = voiceContext.current;
    voiceContext.current = null;
    void context?.close();
    const features = extractVoiceFeatures(voiceSamples.current, voiceElapsed.current);
    voiceAnalyser.current = null;
    setVoiceFeatures(features);
    setVoiceStatus("captured");
  };

  const startVoice = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setWaveHistory([]);
      setVoiceStatus("unavailable");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      voiceStream.current = stream;
      voiceContext.current = context;
      voiceAnalyser.current = analyser;
      voiceSamples.current = [];
      voiceFirstFrame.current = null;
      voiceElapsed.current = 0;
      wavePhase.current = 0;
      waveAmplitude.current = 0;
      waveFrequency.current = mapPitchToWaveFrequency(null);
      waveLastTimestamp.current = null;
      setWaveHistory([]);
      setVoiceFeatures(null);
      setVoiceStatus("recording");
      voiceFrame.current = requestAnimationFrame(sampleVoice);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setWaveHistory([]);
      setVoiceStatus("denied");
    }
  };

  const voiceLabel =
    voiceStatus === "recording"
      ? "声の特徴を取得しています。終わったら停止してください。"
      : voiceStatus === "captured"
        ? "声の特徴を取得しました。録音は保存していません。"
        : voiceStatus === "denied"
          ? "マイクが許可されませんでした。別の方法で表現できます。"
          : voiceStatus === "unavailable"
            ? "このブラウザではマイクを使えません。別の方法で表現できます。"
            : "声の内容は通信・保存せず、声の出し方の特徴だけを使います。";

  const canAnalyze = (voiceFeatures?.durationMs ?? 0) > 0;

  const analyze = async () => {
    if (isAnalyzing || !canAnalyze) return;
    setIsAnalyzing(true);
    try {
      const next = runLocalExperiment(expression, [], voiceFeatures);
      if ("error" in next) {
        setError(next.error);
        setResult(null);
      } else {
        setError("");
        const endpoint = import.meta.env.VITE_SENSORY_BRIDGE_API_URL as string | undefined;
        const provider = endpoint?.trim()
          ? createHttpSensoryBridgeProvider(endpoint.trim())
          : createFixtureSensoryBridgeProvider();
        setResult(await runVoiceSemanticExperiment(next, voiceFeatures!, provider));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    if (voiceFrame.current !== null) cancelAnimationFrame(voiceFrame.current);
    voiceFrame.current = null;
    voiceStream.current?.getTracks().forEach((track) => track.stop());
    voiceStream.current = null;
    void voiceContext.current?.close();
    voiceContext.current = null;
    voiceAnalyser.current = null;
    voiceSamples.current = [];
    voiceFirstFrame.current = null;
    voiceElapsed.current = 0;
    setExpression("");
    setResult(null);
    setIsAnalyzing(false);
    setError("");
    wavePhase.current = 0;
    waveAmplitude.current = 0;
    waveFrequency.current = mapPitchToWaveFrequency(null);
    waveLastTimestamp.current = null;
    setWaveHistory([]);
    setVoiceFeatures(null);
    setVoiceStatus("idle");
  };

  const returnToStart = () => {
    reset();
    onBack?.();
  };

  if (result) {
    return (
      <main className="experience-screen" aria-labelledby="result-title">
        <nav className="experience-screen__nav" aria-label="画面の移動">
          <button className="icon-text-button" type="button" onClick={returnToStart}>
            <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>最初に戻る</span>
          </button>
          <ExperienceBrand />
        </nav>
        <Result result={result} onTryAgain={reset} />
      </main>
    );
  }

  return (
    <main className="experience-screen" aria-labelledby="experiment-title">
      {onBack && (
        <nav className="experience-screen__nav" aria-label="画面の移動">
          <button className="icon-text-button" type="button" onClick={returnToStart}>
            <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>戻る</span>
          </button>
          <ExperienceBrand />
        </nav>
      )}
      <header className="experience-screen__header">
        <h1 id="experiment-title">声の出し方で表現してみてください。</h1>
        <p>「スー」「ジュッ」など、感じたままの声を自由に出してみましょう。</p>
      </header>
      <section className="voice-primary" aria-labelledby="voice-primary-title">
        <div className="input-card input-card--voice">
          <span className="input-card__step">声の表現</span>
          <h2 id="voice-primary-title">声の出し方で表現する</h2>
          <span className="input-card__hint">
            声の高さや強さ、続き方などを使います。声の内容は分析しません。
          </span>
          <button
            className="button button--primary"
            type="button"
            onClick={voiceStatus === "recording" ? stopVoice : startVoice}
          >
            <Mic size={19} strokeWidth={1.8} aria-hidden="true" />
            {voiceStatus === "recording" ? "音声入力を止める" : "音声入力を始める"}
          </button>
          <span className="input-card__hint">{voiceLabel}</span>
          {voiceStatus === "recording" && (
            <div className="voice-visualizer" role="status" aria-label="声の高さの変化を表示中">
              <svg viewBox="0 0 320 64" aria-hidden="true">
                <line x1="0" y1="32" x2="320" y2="32" />
                <path d={createSyntheticWavePath(waveHistory)} />
              </svg>
            </div>
          )}
          <div className="voice-text-fallback">
            <span className="input-card__step">言葉を添えたい場合</span>
            <input
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              placeholder="短い表現を入力"
              maxLength={24}
              aria-label="感じたことば"
            />
          </div>
        </div>
      </section>
      {isAnalyzing && (
        <ExpressionTransform mode="voice" features={voiceFeatures!} waveHistory={waveHistory} />
      )}
      {!isAnalyzing && (
        <div className="experiment__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={analyze}
            disabled={!canAnalyze}
          >
            この表現から言葉を探す
          </button>
          <button className="icon-text-button" type="button" onClick={reset}>
            <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
            リセット
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!canAnalyze && <p className="input-guidance">音声を入力すると、表現を探せます。</p>}
      <footer className="experience-screen__footer">
        <span>正解を決めるのではなく、感じたことから言葉への入口を探します。</span>
      </footer>
    </main>
  );
}
