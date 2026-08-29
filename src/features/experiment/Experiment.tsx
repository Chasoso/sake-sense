import { useRef, useState } from "react";
import { runLocalExperiment, type ExperimentResult } from "../../domain/experiment";
import { createGesturePath, type GesturePoint } from "../../domain/gesture";

function pointFromEvent(event: React.PointerEvent<SVGSVGElement>): GesturePoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const scaleX = rect.width > 0 ? 320 / rect.width : 1;
  const scaleY = rect.height > 0 ? 160 / rect.height : 1;
  return {
    x: Math.min(Math.max(Math.round((event.clientX - rect.left) * scaleX), 0), 320),
    y: Math.min(Math.max(Math.round((event.clientY - rect.top) * scaleY), 0), 160),
    t: Number.isFinite(event.timeStamp) ? Math.max(Math.round(event.timeStamp), 0) : 0,
  };
}

export function Experiment() {
  const [expression, setExpression] = useState("");
  const [points, setPoints] = useState<GesturePoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const capturedPointerId = useRef<number | null>(null);

  const releasePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (capturedPointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    capturedPointerId.current = null;
  };

  const startStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A lost pointer target should not prevent the local experiment from rendering.
    }
    capturedPointerId.current = event.pointerId;
    setDrawing(true);
    setPoints([pointFromEvent(event)]);
    setResult(null);
    setError("");
  };

  const continueStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drawing && capturedPointerId.current === event.pointerId) {
      const point = pointFromEvent(event);
      setPoints((current) => [...current, point]);
    }
  };

  const finishStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || capturedPointerId.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    setDrawing(false);
    setPoints((current) => [...current, point]);
    releasePointer(event);
  };

  const cancelStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || capturedPointerId.current !== event.pointerId) return;
    setDrawing(false);
    releasePointer(event);
  };

  const analyze = () => {
    const next = runLocalExperiment(expression, points);
    if ("error" in next) {
      setError(next.error);
      setResult(null);
    } else {
      setError("");
      setResult(next);
    }
  };

  const reset = () => {
    setExpression("");
    setPoints([]);
    setResult(null);
    setError("");
  };

  const path = createGesturePath(points);

  return (
    <main className="experiment" aria-labelledby="experiment-title">
      <header className="experiment__header">
        <p className="experiment__eyebrow">EXP-001 · local experiment</p>
        <h1 id="experiment-title">感覚を、ことばの入口へ。</h1>
        <p>専門用語ではなく、あなたの感じた音や動きから始める 30〜60 秒の小さな実験です。</p>
      </header>

      <section className="experiment__grid" aria-label="感覚入力">
        <label className="input-card">
          <span className="input-card__step">01 · everyday expression</span>
          <strong>感じた音・ことば</strong>
          <span className="input-card__hint">例: スッ、じわ〜、ふわっ</span>
          <input
            value={expression}
            onChange={(event) => setExpression(event.target.value)}
            placeholder="短い表現を入力"
            maxLength={24}
            aria-label="感じた音やことば"
          />
        </label>

        <div className="input-card">
          <span className="input-card__step">02 · one pointer gesture</span>
          <strong>ひと筆で描く</strong>
          <span className="input-card__hint">速さや終わり方を手がかりにします</span>
          <svg
            className="gesture-pad"
            viewBox="0 0 320 160"
            role="img"
            aria-label="ポインターで一筆描くエリア"
            onPointerDown={startStroke}
            onPointerMove={continueStroke}
            onPointerUp={finishStroke}
            onPointerCancel={cancelStroke}
          >
            <rect width="320" height="160" rx="14" />
            {path ? (
              <path d={path} className="gesture-pad__line" fill="none" />
            ) : (
              <text x="160" y="88" textAnchor="middle">
                ここに一筆
              </text>
            )}
          </svg>
          <button
            className="text-button"
            type="button"
            onClick={() => setPoints([])}
            disabled={!points.length}
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
      {result && <Result result={result} />}

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

function Result({ result }: { result: ExperimentResult }) {
  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result__heading">
        <p className="experiment__eyebrow">03 · bridge, not verdict</p>
        <h2 id="result-title">あなたの表現から見えた手がかり</h2>
        <p>{result.message}</p>
      </div>
      <div className="result__representation">
        <span>your expression</span>
        <strong>{result.expression}</strong>
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
      <details className="debug-view">
        <summary>開発者向けに計算過程を見る</summary>
        <pre>
          {JSON.stringify(
            { gesture: result.gesture, representation: result.representation },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
