import { useEffect, useRef, useState } from "react";
import { runLocalExperiment, type ExperimentResult } from "../../domain/experiment";
import {
  extractBodyMovementFeatures,
  bodyToRepresentation,
  humanizeBodyFeatures,
  type BodyLandmark,
  type BodyMovementFeatures,
  type BodyPoseFrame,
} from "../../domain/body";
import { humanizeRepresentation } from "../../domain/translation-trail";
import { createBodyPoseLandmarker, isCameraSupported, toBodyLandmarks } from "./body-pose";
import { Result } from "../experiment/Experiment";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type CaptureStatus =
  | "idle"
  | "loading"
  | "ready"
  | "capturing"
  | "captured"
  | "denied"
  | "unavailable";

const connections: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

function drawPose(canvas: HTMLCanvasElement, landmarks: BodyLandmark[] | null): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.strokeStyle = "#e2b96c";
  context.fillStyle = "#f1cb84";
  context.lineWidth = 3;
  connections.forEach(([fromIndex, toIndex]) => {
    const from = landmarks[fromIndex];
    const to = landmarks[toIndex];
    if (!from || !to) return;
    context.beginPath();
    context.moveTo(from.x * canvas.width, from.y * canvas.height);
    context.lineTo(to.x * canvas.width, to.y * canvas.height);
    context.stroke();
  });
  landmarks.forEach((landmark) => {
    if ((landmark.visibility ?? 1) < 0.35) return;
    context.beginPath();
    context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2);
    context.fill();
  });
}

export function BodyExperiment({ onFallback }: { onFallback: () => void }) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [features, setFeatures] = useState<BodyMovementFeatures | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const framesRef = useRef<BodyPoseFrame[]>([]);

  const stopCapture = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  };

  useEffect(() => stopCapture, []);

  const prepareCamera = async () => {
    if (!isCameraSupported()) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video element is unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      landmarkerRef.current = await createBodyPoseLandmarker();
      setStatus("ready");
    } catch {
      stopCapture();
      setStatus("denied");
      setError("カメラを利用できませんでした。既存のEXP-002入力を使えます。");
    }
  };

  const sample = (timestamp: number) => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;
    const elapsed = timestamp - startedAtRef.current;
    const detection = landmarker.detectForVideo(video, timestamp);
    const landmarks = detection.landmarks[0];
    if (landmarks) {
      const bodyLandmarks = toBodyLandmarks(landmarks);
      framesRef.current.push({ t: elapsed, landmarks: bodyLandmarks });
      drawPose(canvasRef.current!, bodyLandmarks);
    }
    if (elapsed >= 3000) {
      const captured = extractBodyMovementFeatures(framesRef.current);
      setFeatures(captured);
      setStatus("captured");
      stopCapture();
      return;
    }
    animationRef.current = requestAnimationFrame(sample);
  };

  const startCapture = () => {
    if (status !== "ready" || !landmarkerRef.current) return;
    framesRef.current = [];
    setFeatures(null);
    setResult(null);
    setError("");
    setStatus("capturing");
    startedAtRef.current = performance.now();
    animationRef.current = requestAnimationFrame(sample);
  };

  const retry = () => {
    stopCapture();
    framesRef.current = [];
    setFeatures(null);
    setResult(null);
    setStatus("idle");
    void prepareCamera();
  };

  const analyze = () => {
    if (!features) return;
    const next = runLocalExperiment("", [], null, features);
    if ("error" in next) setError(next.error);
    else setResult(next);
  };

  const bodyRepresentation = features ? bodyToRepresentation(features) : null;
  const hintItems = bodyRepresentation ? humanizeRepresentation(bodyRepresentation) : [];

  if (result) return <Result result={result} onTryAgain={retry} />;

  return (
    <main className="experiment" aria-labelledby="body-experiment-title">
      <header className="experiment__header">
        <p className="experiment__eyebrow">EXP-003 · local body experiment</p>
        <h1 id="body-experiment-title">この味、体でやってみてください。</h1>
        <p>3秒くらいの動きで表現してください。手だけでも、上半身でもOKです。正解はありません。</p>
      </header>
      <section className="body-capture-card" aria-label="身体表現のカメラ入力">
        <div className="body-capture-card__copy">
          <h2>あなたの動きを見てみる</h2>
          <p>
            映像は端末内で処理され、保存・送信されません。カメラは身体の動きの特徴だけを一時的に取得します。
          </p>
        </div>
        <div className="body-camera" data-status={status}>
          <video ref={videoRef} muted playsInline aria-label="身体表現のカメラプレビュー" />
          <canvas ref={canvasRef} width="640" height="360" aria-hidden="true" />
          {status === "idle" && <span>カメラを準備してください</span>}
          {status === "capturing" && <span>動いてください…</span>}
          {status === "captured" && <span>動きを取得しました</span>}
        </div>
        <div className="body-capture-card__actions">
          {status === "idle" && (
            <button className="primary-button" type="button" onClick={prepareCamera}>
              カメラを準備する
            </button>
          )}
          {status === "loading" && <span>カメラを準備しています…</span>}
          {status === "ready" && (
            <button className="primary-button" type="button" onClick={startCapture}>
              3秒の動きを始める
            </button>
          )}
          {status === "capturing" && <span>身体表現を取得中…</span>}
          {status === "captured" && (
            <button className="primary-button" type="button" onClick={analyze}>
              特徴と言葉への橋を見る
            </button>
          )}
          {(status === "captured" || status === "denied" || status === "unavailable") && (
            <button className="text-button" type="button" onClick={retry}>
              もう一度試す
            </button>
          )}
        </div>
        {(status === "denied" || status === "unavailable") && (
          <p className="form-error" role="alert">
            {error || "カメラが利用できません。EXP-002の声・動き入力を使ってください。"}
          </p>
        )}
        {features && (
          <section className="body-features" aria-labelledby="body-features-title">
            <h2 id="body-features-title">身体表現から見えた特徴</h2>
            <ul>
              {humanizeBodyFeatures(features).map((summary) => (
                <li key={summary}>{summary}</li>
              ))}
            </ul>
            <p className="body-features__note">
              これらは観測した動きの特徴です。味そのものを判定したものではありません。
            </p>
            <div className="tag-list">
              {hintItems.map((hint) => (
                <span key={hint.internal}>{hint.label}</span>
              ))}
            </div>
          </section>
        )}
        <button className="text-button" type="button" onClick={onFallback}>
          EXP-002の声・指の動きを使う
        </button>
      </section>
    </main>
  );
}
