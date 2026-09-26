import { useRef, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { runGestureSemanticExperiment, type ExperimentResult } from "../../domain/experiment";
import {
  createGesturePath,
  extractGestureFeatures,
  type GesturePoint,
  type GestureStroke,
} from "../../domain/gesture";
import { clientToViewBoxPoint } from "./coordinate";
import { Result } from "./Experiment";
import {
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
} from "../../domain/sensory-bridge";
import { evaluateGestureSensorySupport } from "../../domain/sensory-support-cases";
import { ExperienceBrand } from "./ExperienceBrand";
import { GestureProcessingScreen } from "./processing-screens";
import { useScreenScrollReset } from "./use-screen-scroll-reset";

function pointFromEvent(event: React.PointerEvent<SVGSVGElement>): GesturePoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const scaleX = rect.width > 0 ? 320 / rect.width : 1;
  const scaleY = rect.height > 0 ? 160 / rect.height : 1;
  const fallback = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
  const ctm = event.currentTarget.getScreenCTM();
  const point = clientToViewBoxPoint(
    event.clientX,
    event.clientY,
    ctm ? { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f } : null,
    fallback,
  );
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
    t: Number.isFinite(event.timeStamp) ? Math.max(Math.round(event.timeStamp), 0) : 0,
  };
}

export function GestureExperiment({ onBack }: { onBack?: () => void } = {}) {
  const [strokes, setStrokes] = useState<GestureStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const capturedPointerId = useRef<number | null>(null);
  useScreenScrollReset(result ?? (isAnalyzing ? "gesture-processing" : null));

  const releasePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (capturedPointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    capturedPointerId.current = null;
  };

  const startStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A lost pointer target should not prevent the local experiment from rendering.
    }
    capturedPointerId.current = event.pointerId;
    setDrawing(true);
    setStrokes((current) => [...current, [point]]);
    setResult(null);
    setError("");
  };

  const continueStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drawing && capturedPointerId.current === event.pointerId) {
      const point = pointFromEvent(event);
      setStrokes((current) => {
        if (current.length === 0) return current;
        const next = [...current];
        next[next.length - 1] = [...next[next.length - 1], point];
        return next;
      });
    }
  };

  const finishStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || capturedPointerId.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    setDrawing(false);
    setStrokes((current) => {
      if (current.length === 0) return current;
      const next = [...current];
      next[next.length - 1] = [...next[next.length - 1], point];
      return next;
    });
    releasePointer(event);
  };

  const cancelStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || capturedPointerId.current !== event.pointerId) return;
    setDrawing(false);
    releasePointer(event);
  };

  const canAnalyze = strokes.some((stroke) => stroke.length >= 2);
  const analyze = async () => {
    if (isAnalyzing || !canAnalyze) return;
    setIsAnalyzing(true);
    try {
      const features = extractGestureFeatures(strokes);
      const endpoint = import.meta.env.VITE_SENSORY_BRIDGE_API_URL as string | undefined;
      const provider = endpoint?.trim()
        ? createHttpSensoryBridgeProvider(endpoint.trim())
        : createFixtureSensoryBridgeProvider();
      const next = await runGestureSemanticExperiment(features, provider);
      if ("error" in next) {
        setError(next.error);
        setResult(null);
      } else {
        setError("");
        setResult(next);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setStrokes([]);
    setDrawing(false);
    setResult(null);
    setError("");
    setIsAnalyzing(false);
    capturedPointerId.current = null;
  };

  const returnToStart = () => {
    reset();
    onBack?.();
  };

  if (result) {
    const gestureCalibrationEnabled =
      import.meta.env.DEV && import.meta.env.VITE_GESTURE_CALIBRATION === "true";
    const calibrationResponse = result.sensoryBridge?.response;
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
        {gestureCalibrationEnabled && result.sensoryBridge?.modality === "gesture" && (
          <pre data-testid="gesture-calibration-diagnostics" hidden>
            {JSON.stringify({
              features: result.gesture,
              matchedCaseIds: calibrationResponse?.groundingCaseIds ?? [],
              resultKind: evaluateGestureSensorySupport(result.gesture).resultKind,
              expressionIds: calibrationResponse?.groundingExpressionIds ?? [],
              candidateTermIds: calibrationResponse?.candidateTermIds ?? [],
            })}
          </pre>
        )}
      </main>
    );
  }

  if (isAnalyzing) {
    return <GestureProcessingScreen strokes={strokes} onBack={returnToStart} />;
  }

  return (
    <main className="experience-screen" aria-labelledby="gesture-title">
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
        <h1 id="gesture-title">指の動きで表現してみてください。</h1>
        <p>なめらか、鋭い、広がる。感じたままに、指で線を描いてみましょう。</p>
      </header>
      <section className="input-card input-card--gesture" aria-labelledby="gesture-input-title">
        <span className="input-card__step">指の表現</span>
        <h2 id="gesture-input-title">線を描いて表現する</h2>
        <span className="input-card__hint">描き方や速さを、線の動きとしてこの場で整理します。</span>
        <svg
          className="gesture-pad"
          viewBox="0 0 320 160"
          role="img"
          aria-label="指で自由に線を描くエリア"
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={finishStroke}
          onPointerCancel={cancelStroke}
        >
          <rect width="320" height="160" rx="7" />
          {strokes.length ? (
            strokes.map((stroke, index) => (
              <path
                key={index}
                d={createGesturePath(stroke)}
                className="gesture-pad__line"
                fill="none"
              />
            ))
          ) : (
            <text x="160" y="88" textAnchor="middle">
              ここに自由に描く
            </text>
          )}
        </svg>
        <div className="gesture-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
          >
            描き直す
          </button>
          <button
            className="button button--primary"
            type="button"
            onClick={analyze}
            disabled={!canAnalyze}
          >
            この動きから言葉を探す
          </button>
        </div>
      </section>
      {isAnalyzing && (
        <section
          className="expression-transform expression-transform--gesture"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="expression-transform__eyebrow">表現を整理しています</p>
          <h2>指の動きからことばへの入口を探しています。</h2>
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!canAnalyze && <p className="input-guidance">線を描くと、表現を探せます。</p>}
      <div className="experiment__actions">
        <button className="icon-text-button" type="button" onClick={reset}>
          <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
          リセット
        </button>
      </div>
      <footer className="experience-screen__footer">
        <span>この段階では、指の動きは端末内で整理しています。</span>
      </footer>
    </main>
  );
}
