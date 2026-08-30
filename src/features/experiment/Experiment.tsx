import { useEffect, useRef, useState } from "react";
import { runLocalExperiment, type ExperimentResult } from "../../domain/experiment";
import { createGesturePath, type GesturePoint, type GestureStroke } from "../../domain/gesture";
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
import { presentEvidenceStatus } from "../../domain/sake-product-matching";

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

export function Experiment() {
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
      ? "Listening locally… click stop when finished"
      : voiceStatus === "captured"
        ? "Voice captured locally; no recording was saved"
        : voiceStatus === "denied"
          ? "Microphone permission was denied. Use the text fallback below."
          : voiceStatus === "unavailable"
            ? "Microphone is unavailable in this browser. Use the text fallback below."
            : "Say a short sensory expression; the recording stays in this browser.";

  const analyze = () => {
    const next = runLocalExperiment(expression, strokes, voiceFeatures);
    if ("error" in next) {
      setError(next.error);
      setResult(null);
    } else {
      setError("");
      setResult(next);
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
    setError("");
    wavePhase.current = 0;
    waveAmplitude.current = 0;
    waveFrequency.current = mapPitchToWaveFrequency(null);
    waveLastTimestamp.current = null;
    setWaveHistory([]);
    setVoiceFeatures(null);
    setVoiceStatus("idle");
  };

  return (
    <main className="experiment" aria-labelledby="experiment-title">
      <header className="experiment__header">
        <p className="experiment__eyebrow">EXP-002 · local experiment</p>
        <h1 id="experiment-title">感覚を、ことばの入口へ。</h1>
        <p>専門用語ではなく、あなたの感じた音や動きから始める 30〜60 秒の小さな実験です。</p>
      </header>

      <section className="experiment__grid" aria-label="感覚入力">
        <label className="input-card input-card--voice">
          <span className="input-card__step">01 · voice-first expression</span>
          <strong>声で感じたことを話す</strong>
          <span className="input-card__hint">
            短い声の表現から始めます。音声は保存・uploadしません。
          </span>
          <button
            className="primary-button"
            type="button"
            onClick={voiceStatus === "recording" ? stopVoice : startVoice}
          >
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
          <span className="input-card__fallback">音声が使えない場合のテキスト fallback</span>
          <input
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="短い表現を入力"
            maxLength={24}
            aria-label="感じた音やことば"
          />
        </label>

        <div className="input-card">
          <span className="input-card__step">02 · free movement</span>
          <strong>自由な動きで表現する</strong>
          <span className="input-card__hint">1〜2秒ほど、形・速さ・方向を自由に動かします</span>
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
            <rect width="320" height="160" rx="14" />
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
      </section>

      <div className="experiment__actions">
        <button className="primary-button" type="button" onClick={analyze}>
          ことばへの橋を見てみる
        </button>
        <button className="text-button" type="button" onClick={reset}>
          リセット
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && <Result result={result} onTryAgain={() => setResult(null)} />}

      <footer className="experiment__footer">
        <strong>実験中の表示です。</strong>
        <span>
          候補は断定ではありません。ノンバーバルな表現は、ことばの代わりではなく入口です。
        </span>
        <span>石川の酒文化との接続は、出典のある小さなデータから今後の実験で探ります。</span>
      </footer>
    </main>
  );
}

function Result({ result, onTryAgain }: { result: ExperimentResult; onTryAgain: () => void }) {
  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result__heading">
        <p className="experiment__eyebrow">03 · bridge, not verdict</p>
        <h2 id="result-title">あなたの表現から見えた手がかり</h2>
        <p>{result.message}</p>
      </div>
      <div className="result__representation">
        <span>your expression</span>
        <strong>{result.expression || "voice (no transcription)"}</strong>
        <span>shared sensory hints</span>
        <div className="tag-list">
          {result.representation.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      {result.candidates.length > 0 ? (
        <div className="candidate-list">
          {result.candidates.map((candidate) => (
            <article className="candidate" key={candidate.entry.id}>
              <div>
                <span className="candidate__match">
                  {candidate.matchedBy === "both"
                    ? "two signals meet"
                    : `${candidate.matchedBy} signal`}
                </span>
                <h3>{candidate.entry.displayTerm}</h3>
              </div>
              <p>{candidate.entry.definitionSummary}</p>
              <p className="candidate__why">{candidate.explanation}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-result">この辞書の範囲では、まだ候補に結びつきませんでした。</p>
      )}
      <section className="sake-connection" aria-labelledby="sake-connection-title">
        <div className="sake-connection__heading">
          <span className="experiment__eyebrow">04 · real sake to explore</span>
          <h3 id="sake-connection-title">この言葉を実際の石川の日本酒で確かめる候補</h3>
          <p>
            候補語と出典付きサンプルのterm参照が重なった商品を表示しています。おすすめや順位付けではありません。
          </p>
        </div>
        {result.sakeProducts.length > 0 ? (
          <div className="sake-product-list">
            {result.sakeProducts.map((match) => (
              <article className="sake-product" key={match.product.id}>
                <h4>{match.product.name}</h4>
                <p className="sake-product__producer">{match.product.producer.name}</p>
                <p>{match.product.descriptionSummary}</p>
                <p className="sake-product__why">
                  この商品は、候補語とterm参照が重なるため表示しています。
                </p>
                <ul className="sake-product__evidence">
                  {match.matchedReferences.map((reference) => {
                    const term = result.candidates.find(
                      (candidate) => candidate.entry.id === reference.termId,
                    )?.entry.displayTerm;
                    const evidence = presentEvidenceStatus(reference.mappingStatus);
                    return (
                      <li key={reference.termId}>
                        <strong>{term ?? reference.termId}</strong>
                        <span>{evidence.label}</span>
                        <p>{evidence.explanation}</p>
                        <p>{reference.rationale}</p>
                      </li>
                    );
                  })}
                </ul>
                <p className="sake-product__source">
                  <a href={match.product.sourceUrl} target="_blank" rel="noreferrer">
                    商品情報（公式）
                  </a>
                  {match.product.provenance.slice(1).map((source) => (
                    <span key={source.sourceId}>
                      {" · "}
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.sourceType}
                      </a>
                    </span>
                  ))}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-result">
            今回の小さなサンプルには、この候補語を直接支える商品がありません。別の表現で試すか、辞書と出典を確認してください。
          </p>
        )}
      </section>
      <button className="text-button" type="button" onClick={onTryAgain}>
        別の感じで試してみる
      </button>
      <details className="debug-view">
        <summary>開発者向けに計算過程を見る</summary>
        <pre>
          {JSON.stringify(
            {
              inputSource: result.inputSource,
              transcription: result.expression || null,
              voice: result.voiceFeatures,
              gesture: result.gesture,
              representation: result.representation,
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
