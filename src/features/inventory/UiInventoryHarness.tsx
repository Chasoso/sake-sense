import { ArrowLeft, Mic, Play, RotateCcw, SwitchCamera } from "lucide-react";
import { useEffect, useState } from "react";
import {
  runBodySemanticExperiment,
  runGestureSemanticExperiment,
  runLocalExperiment,
  runVoiceSemanticExperiment,
  type ExperimentResult,
} from "../../domain/experiment";
import type { BodyMovementFeatures } from "../../domain/body";
import type { GestureFeatures } from "../../domain/gesture";
import type { VoiceFeatures } from "../../domain/voice";
import { Result } from "../experiment/Experiment";
import { SourcesPage } from "../sources/SourcesPage";
import { ExperienceBrand } from "../experiment/ExperienceBrand";

export type UiInventoryState =
  | "body-loading"
  | "body-ready"
  | "body-countdown"
  | "body-capturing"
  | "body-replay"
  | "body-result"
  | "body-no-match"
  | "body-denied"
  | "voice-initial"
  | "voice-recording"
  | "voice-analyzing"
  | "voice-result"
  | "voice-no-match"
  | "gesture-initial"
  | "gesture-drawing"
  | "gesture-result"
  | "sources";

const bodyFeatures: BodyMovementFeatures = {
  frameCount: 12,
  captureDurationMs: 3000,
  activeDurationMs: 1200,
  totalMovement: 3,
  averageSpeed: 0.0025,
  peakSpeed: 0.004,
  spread: 3,
  hasMeaningfulMovement: true,
  activeJointCount: 4,
  endingSpeedRatio: 0.9,
  endingBehavior: "abrupt",
  hasSustainedFastMovement: false,
  motionShape: {
    expansion: "expanding",
    dominantDirection: "unknown",
    repetition: "single",
    participation: "broad",
  },
};

const voiceFeatures: VoiceFeatures = {
  durationMs: 1200,
  averageIntensity: 0.4,
  pauseCount: 1,
  endingBehavior: "fading",
};

const gestureFeatures: GestureFeatures = {
  pointCount: 12,
  durationMs: 900,
  pathLength: 90,
  averageSpeed: 0.1,
  spread: 80,
  horizontalDirectionChanges: 0,
  endingSpeedRatio: 0.4,
  abruptEnding: false,
};

function InventoryNav() {
  return (
    <nav className="experience-screen__nav" aria-label="画面の移動">
      <button className="icon-text-button" type="button">
        <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
        <span>戻る</span>
      </button>
      <ExperienceBrand />
    </nav>
  );
}

function MockBodyCamera({ state }: { state: UiInventoryState }) {
  const isCaptured = state === "body-replay";
  const isDenied = state === "body-denied";
  const isCountdown = state === "body-countdown";
  const isCapturing = state === "body-capturing";
  const status = isCaptured ? "captured" : isDenied ? "denied" : state.replace("body-", "");

  return (
    <main
      className="experience-screen experience-screen--body-capture experience-screen--body-shell ui-inventory-fixture"
      data-ui-inventory-ready="true"
      data-ui-inventory-state={state}
    >
      <h1 className="screen-reader-only">体で表現してみてください</h1>
      <section className="body-capture-card body-capture-card--dedicated" data-status={status}>
        <div className="body-camera" data-status={status} data-presentation-mirrored="true">
          <div className="ui-inventory-camera-scene" aria-label="Body camera preview">
            <div className="ui-inventory-person" aria-hidden="true">
              <div className="ui-inventory-person__head" />
              <div className="ui-inventory-person__body" />
              <div className="ui-inventory-person__arm ui-inventory-person__arm--left" />
              <div className="ui-inventory-person__arm ui-inventory-person__arm--right" />
            </div>
            <svg className="ui-inventory-contour" viewBox="0 0 640 360" aria-hidden="true">
              <path d="M240 285 C210 255 205 190 230 150 C245 125 260 100 315 96 C370 100 395 130 405 165 C420 205 410 245 392 286" />
            </svg>
          </div>
          <nav className="body-camera__top-overlay" aria-label="画面の移動">
            <button className="body-camera__back" type="button">
              <ArrowLeft size={17} />
              <span>戻る</span>
            </button>
          </nav>
          {!isCaptured && !isDenied && (
            <button className="body-camera__switch" type="button" aria-label="カメラを切り替える">
              <SwitchCamera size={19} />
            </button>
          )}
          {isCountdown && (
            <div className="body-camera__countdown" role="status">
              3
            </div>
          )}
          {status === "ready" && !isCountdown && (
            <div className="body-camera__guide">
              <span>動きで表現してみてください</span>
            </div>
          )}
          {isCaptured && (
            <button className="body-camera__replay-control" type="button" aria-label="再生">
              <Play size={24} />
            </button>
          )}
          <div className="body-camera__bottom-overlay" aria-live="polite">
            {state === "body-loading" && <span>カメラを準備しています…</span>}
            {isDenied && (
              <p className="form-error" role="alert">
                カメラが許可されませんでした。別の方法で表現してみてください。
              </p>
            )}
            {isCapturing && <span>記録中…</span>}
            {isCountdown && <span>準備してください</span>}
            {state === "body-ready" && (
              <button
                className="body-record-control__button"
                type="button"
                aria-label="3秒の動きを始める"
              >
                <span aria-hidden="true" />
              </button>
            )}
            {isCaptured && <span>再生できます</span>}
          </div>
        </div>
      </section>
    </main>
  );
}

function MockVoice({ state }: { state: UiInventoryState }) {
  const isRecording = state === "voice-recording";
  const isAnalyzing = state === "voice-analyzing";
  return (
    <main
      className="experience-screen ui-inventory-fixture"
      data-ui-inventory-ready="true"
      data-ui-inventory-state={state}
    >
      <InventoryNav />
      <header className="experience-screen__header">
        <h1>声の表現で試してみてください</h1>
        <p>声の高さや強さ、続き方などを使います。声の内容は保存しません。</p>
      </header>
      <section className="voice-primary">
        <div className="input-card input-card--voice">
          <span className="input-card__step">声の表現</span>
          <h2>声の出し方で表現する</h2>
          <span className="input-card__hint">声の特徴を取得します。内容は保存しません。</span>
          <button className="button button--primary" type="button">
            <Mic size={19} />
            {isRecording ? "音声入力を止める" : "音声入力を始める"}
          </button>
          <span className="input-card__hint">
            {isRecording
              ? "声の特徴を取得しています…"
              : "声の内容は通信・保存せず、声の特徴だけを使います。"}
          </span>
          {isRecording && (
            <div className="voice-visualizer">
              <svg viewBox="0 0 320 64" aria-hidden="true">
                <line x1="0" y1="32" x2="320" y2="32" />
                <path d="M0 32 C30 5 50 58 80 32 S130 7 160 32 S210 60 240 32 S290 8 320 32" />
              </svg>
            </div>
          )}
        </div>
      </section>
      {isAnalyzing && (
        <section className="expression-transform expression-transform--voice" aria-live="polite">
          <p className="expression-transform__eyebrow">表現を整理しています</p>
          <h2>声の特徴からことばへの入口を探しています</h2>
        </section>
      )}
      {!isAnalyzing && (
        <div className="experiment__actions">
          <button className="button button--primary" type="button" disabled={!isRecording}>
            この表現から言葉を探す
          </button>
          <button className="icon-text-button" type="button">
            <RotateCcw size={17} />
            リセット
          </button>
        </div>
      )}
    </main>
  );
}

function MockGesture({ state }: { state: UiInventoryState }) {
  const isDrawing = state === "gesture-drawing";
  return (
    <main
      className="experience-screen ui-inventory-fixture"
      data-ui-inventory-ready="true"
      data-ui-inventory-state={state}
    >
      <InventoryNav />
      <header className="experience-screen__header">
        <h1>指の動きで表現してみてください</h1>
        <p>なめらか、強さ、広がりなど、感じたままに指で線を描いてみましょう。</p>
      </header>
      <section className="input-card input-card--gesture">
        <span className="input-card__step">指の表現</span>
        <h2>線を描いて表現する</h2>
        <span className="input-card__hint">描き方や速さを、動きの特徴として整理します。</span>
        <svg
          className="gesture-pad"
          viewBox="0 0 320 160"
          role="img"
          aria-label="指で自由に線を描くエリア"
        >
          <rect width="320" height="160" rx="7" />
          {isDrawing ? (
            <path
              d="M28 118 C70 30 112 142 156 60 S236 36 292 106"
              className="gesture-pad__line"
              fill="none"
            />
          ) : (
            <text x="160" y="88" textAnchor="middle">
              ここに自由に描く
            </text>
          )}
        </svg>
        <div className="gesture-actions">
          <button className="text-button" type="button">
            描き直す
          </button>
          <button className="button button--primary" type="button" disabled={!isDrawing}>
            この動きから言葉を探す
          </button>
        </div>
      </section>
    </main>
  );
}

function NoMatch({ state }: { state: UiInventoryState }) {
  return (
    <main
      className="experience-screen ui-inventory-fixture"
      data-ui-inventory-ready="true"
      data-ui-inventory-state={state}
    >
      <InventoryNav />
      <section className="result result--empty">
        <div className="result__heading">
          <h2>感じられた特徴</h2>
          <p>今回は候補となる日本酒の言葉を見つけられませんでした。</p>
        </div>
        <div className="experiment__actions">
          <button className="button button--primary" type="button">
            別の感じで試してみる
          </button>
        </div>
      </section>
    </main>
  );
}

function InventoryResult({ state }: { state: UiInventoryState }) {
  const [result, setResult] = useState<ExperimentResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next =
        state === "body-result"
          ? await runBodySemanticExperiment(bodyFeatures)
          : state === "gesture-result"
            ? await runGestureSemanticExperiment(gestureFeatures)
            : await runVoiceSemanticExperiment(
                runLocalExperiment("", [], voiceFeatures) as ExperimentResult,
                voiceFeatures,
              );
      if (!cancelled && !("error" in next)) setResult(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (!result)
    return (
      <main className="experience-screen ui-inventory-fixture" data-ui-inventory-state={state}>
        <InventoryNav />
        <p>fixture result loading…</p>
      </main>
    );
  return (
    <main
      className="experience-screen ui-inventory-fixture"
      data-ui-inventory-ready="true"
      data-ui-inventory-state={state}
    >
      <InventoryNav />
      <Result result={result} onTryAgain={() => undefined} />
    </main>
  );
}

export function UiInventoryHarness({ state }: { state: UiInventoryState }) {
  if (state === "sources")
    return (
      <div data-ui-inventory-ready="true" data-ui-inventory-state={state}>
        <SourcesPage onBack={() => undefined} />
      </div>
    );
  if (state.startsWith("body-")) {
    if (state === "body-result") return <InventoryResult state={state} />;
    if (state === "body-no-match") return <NoMatch state={state} />;
    return <MockBodyCamera state={state} />;
  }
  if (state.startsWith("voice-")) {
    if (state === "voice-result") return <InventoryResult state={state} />;
    if (state === "voice-no-match") return <NoMatch state={state} />;
    return <MockVoice state={state} />;
  }
  if (state === "gesture-result") return <InventoryResult state={state} />;
  return <MockGesture state={state} />;
}
