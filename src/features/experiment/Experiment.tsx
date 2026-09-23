import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, RotateCcw } from "lucide-react";
import {
  runLocalExperiment,
  runVoiceSemanticExperiment,
  type ExperimentResult,
} from "../../domain/experiment";
import { humanizeBodyFeatures } from "../../domain/body";
import {
  createGesturePath,
  extractGestureFeatures,
  type GesturePoint,
  type GestureStroke,
} from "../../domain/gesture";
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
import { clientToViewBoxPoint } from "./coordinate";
import { humanizeRepresentation } from "../../domain/translation-trail";
import {
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
} from "../../domain/sensory-bridge";
import { ExpressionTransform } from "./ExpressionTransform";
import {
  getCompactEvidenceLabel,
  getCandidateDisplaySummary,
  getResultPresentationPolicy,
} from "./result-presentation";

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

export function Experiment({ onBack }: { onBack?: () => void } = {}) {
  const [expression, setExpression] = useState("");
  const [strokes, setStrokes] = useState<GestureStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<
    "idle" | "recording" | "captured" | "unavailable" | "denied"
  >("idle");
  const [voiceFeatures, setVoiceFeatures] = useState<VoiceFeatures | null>(null);
  const [waveHistory, setWaveHistory] = useState<SyntheticWavePoint[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const capturedPointerId = useRef<number | null>(null);
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
      ? "端末内で声の特徴を取得しています。終わったら止めてください。"
      : voiceStatus === "captured"
        ? "声の特徴を取得しました。録音は保存していません。"
        : voiceStatus === "denied"
          ? "マイクが許可されませんでした。指の動きでも表現できます。"
          : voiceStatus === "unavailable"
            ? "このブラウザではマイクを使えません。指の動きでも表現できます。"
            : "声の内容は送信・保存せず、声の出し方の特徴だけを使います。";

  const gestureSummary =
    voiceStatus === "denied" || voiceStatus === "unavailable"
      ? "指の動きで表現する"
      : "もっと表現したい場合";
  const gestureFeatures = extractGestureFeatures(strokes);
  const canAnalyze =
    (voiceFeatures?.durationMs ?? 0) > 0 ||
    (gestureFeatures.pointCount >= 2 && gestureFeatures.pathLength > 0);

  const analyze = async () => {
    if (isAnalyzing || !canAnalyze) return;
    setIsAnalyzing(true);
    try {
      const next = runLocalExperiment(expression, strokes, voiceFeatures);
      if ("error" in next) {
        setError(next.error);
        setResult(null);
      } else {
        setError("");
        if (voiceFeatures?.durationMs) {
          const endpoint = import.meta.env.VITE_SENSORY_BRIDGE_API_URL as string | undefined;
          const provider = endpoint?.trim()
            ? createHttpSensoryBridgeProvider(endpoint.trim())
            : createFixtureSensoryBridgeProvider();
          setResult(await runVoiceSemanticExperiment(next, voiceFeatures, provider));
        } else {
          setResult(next);
        }
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
    setStrokes([]);
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
          <span className="experience-screen__brand">Sake Sense</span>
        </nav>
        <Result result={result} onTryAgain={reset} />
      </main>
    );
  }

  return (
    <main className="experience-screen" aria-labelledby="experiment-title">
      {onBack && (
        <nav className="experience-screen__nav" aria-label="画面の移動">
          <button className="icon-text-button" type="button" onClick={onBack}>
            <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>戻る</span>
          </button>
          <span className="experience-screen__brand">Sake Sense</span>
        </nav>
      )}
      <header className="experience-screen__header">
        <h1 id="experiment-title">声の出し方で表現してみてください。</h1>
        <p>「スー」「ギュッ」など、感じたままの声を短く出してみましょう。</p>
      </header>

      <section className="voice-primary" aria-labelledby="voice-primary-title">
        <div className="input-card input-card--voice">
          <span className="input-card__step">声の表現</span>
          <h2 id="voice-primary-title">声の出し方で表現する</h2>
          <span className="input-card__hint">
            声の高さや変化、続き方などを使います。声の内容は文字起こししません。
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
              aria-label="感じた音やことば"
            />
          </div>
        </div>
      </section>

      <details className="optional-input">
        <summary>{gestureSummary}</summary>
        <div className="input-card input-card--gesture">
          <h2>指の動きも加えられます</h2>
          <span className="input-card__hint">形や速さを、線で自由に表現します。</span>
          <svg
            className="gesture-pad"
            viewBox="0 0 320 160"
            role="img"
            aria-label="ポインターで自由に描くエリア"
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
          <button
            className="text-button"
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
          >
            描き直す
          </button>
        </div>
      </details>

      {isAnalyzing && voiceFeatures && (
        <ExpressionTransform mode="voice" features={voiceFeatures} waveHistory={waveHistory} />
      )}
      {isAnalyzing && !voiceFeatures && (
        <section
          className="expression-transform expression-transform--gesture"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="expression-transform__eyebrow">表現の輪郭をたどっています</p>
          <h2>動きが、ことばへ近づいています</h2>
          <p className="expression-transform__status">もうすぐ結果が表示されます…</p>
        </section>
      )}

      {!isAnalyzing && (
        <div className="experiment__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={analyze}
            disabled={!canAnalyze || isAnalyzing}
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
      {!canAnalyze && (
        <p className="input-guidance">
          {voiceStatus === "denied" || voiceStatus === "unavailable"
            ? "指の動きで表現してください。"
            : "声を入力すると、言葉を探せます。"}
        </p>
      )}

      <footer className="experience-screen__footer">
        <span>候補は断定ではありません。感じたことから、言葉への入口を探します。</span>
      </footer>
    </main>
  );
}

export function Result({
  result,
  onTryAgain,
}: {
  result: ExperimentResult;
  onTryAgain: () => void;
}) {
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const isBodyResult = Boolean(result.bodyFeatures);
  const presentation = getResultPresentationPolicy(result, result.candidates.length > 0);
  const sensoryHints = humanizeRepresentation(result.representation);
  const bodyObservations = result.bodyFeatures
    ? humanizeBodyFeatures(result.bodyFeatures).slice(0, 4)
    : [];

  useEffect(() => {
    resultTitleRef.current?.focus();
  }, []);

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result__heading">
        <h2 id="result-title" ref={resultTitleRef} tabIndex={-1}>
          {result.bodyFeatures ? "この動きから見えた感覚" : "あなたの表現から見えた感覚"}
        </h2>
        <p>{presentation.introduction}</p>
      </div>
      <div className="translation-trail" aria-label="表現から日本酒の言葉への流れ">
        {(bodyObservations.length > 0 || sensoryHints.length > 0) && (
          <section className="translation-step translation-step--observed">
            <span className="translation-step__label">{presentation.observedLabel}</span>
            {bodyObservations.length > 0 && (
              <ul className="body-feature-trail">
                {bodyObservations.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            )}
            {sensoryHints.length > 0 && (
              <ul className="translation-hints">
                {sensoryHints.map((hint) => (
                  <li key={hint.internal}>
                    <strong>{hint.label}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {result.candidates.length > 0 && (
          <>
            <section className="translation-step translation-step--candidate">
              <span className="translation-step__label">{presentation.candidateHeading}</span>
              <div className="candidate-list">
                {result.candidates.map((candidate) => (
                  <article className="candidate" key={candidate.entry.id}>
                    <div>
                      <h3>{candidate.entry.displayTerm}</h3>
                    </div>
                    <p>
                      {getCandidateDisplaySummary(
                        candidate.entry.id,
                        candidate.entry.definitionSummary,
                      )}
                    </p>
                  </article>
                ))}
              </div>
              <p className="candidate__uncertainty">
                ※候補となる言葉であり、味わいを確定するものではありません。
              </p>
            </section>
          </>
        )}
      </div>
      {result.sakeProducts.length > 0 && (
        <section className="sake-connection" aria-labelledby="sake-connection-title">
          <div className="sake-connection__heading">
            <h3 id="sake-connection-title">{presentation.productHeading}</h3>
            <p>{presentation.productDescription}</p>
          </div>
          <div className="sake-product-list">
            {result.sakeProducts.map((match) => (
              <article className="sake-product" key={match.product.id}>
                <h4>{match.product.name}</h4>
                <p className="sake-product__producer">{match.product.breweryName}</p>
                <p>{match.product.descriptionSummary}</p>
                <ul className="sake-product__evidence">
                  {match.matchedReferences.map((reference) => {
                    const term = result.candidates.find(
                      (candidate) => candidate.entry.id === reference.termId,
                    )?.entry.displayTerm;
                    return (
                      <li key={reference.termId}>
                        <p className="sake-product__evidence-compact">
                          <strong>{term ?? "対応する日本酒の言葉"}</strong>
                          <span> ｜ {getCompactEvidenceLabel(reference.evidenceStatus)}</span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <p className="sake-product__source">
                  <a href={match.product.sourceUrl} target="_blank" rel="noreferrer">
                    商品情報（公式）
                  </a>
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
      {result.candidates.length === 0 && (
        <div className="result__unmapped" role="status">
          <p>
            {isBodyResult
              ? "今回の動きからは、無理なく対応できる日本酒の言葉はまだ見つかりませんでした。"
              : "今回の表現からは、無理なく対応できる日本酒の言葉はまだ見つかりませんでした。"}
          </p>
        </div>
      )}
      <button className="text-button" type="button" onClick={onTryAgain}>
        別の感じで試してみる
      </button>
      <details className="debug-view">
        <summary>開発者向け詳細</summary>
        <pre>
          {JSON.stringify(
            {
              inputSource: result.inputSource,
              expression: result.expression || null,
              voice: result.voiceFeatures,
              body: result.bodyFeatures,
              gesture: result.gesture,
              representation: result.representation,
              candidates: result.candidates,
              sensoryBridge: result.sensoryBridge,
              sakeProducts: result.sakeProducts,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
