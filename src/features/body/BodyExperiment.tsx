import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Play, RotateCcw } from "lucide-react";
import { runBodySemanticExperiment, type ExperimentResult } from "../../domain/experiment";
import {
  extractBodyMovementFeatures,
  humanizeBodyFeatures,
  type BodyLandmark,
  type BodyMovementFeatures,
  type BodyPoseFrame,
} from "../../domain/body";
import { getReplayDurationMs, getReplayFrameIndex } from "../../domain/body-replay";
import { createBodyPoseLandmarker, isCameraSupported, toBodyLandmarks } from "./body-pose";
import { Result } from "../experiment/Experiment";
import {
  createFixtureSensoryBridgeProvider,
  createHttpSensoryBridgeProvider,
} from "../../domain/sensory-bridge";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  createRealCaptureDiagnostics,
  type MotionExperimentDiagnostic,
} from "../../experiments/motion-representation/real-capture-diagnostics";
import { getBodyCaptureLayout, type BodyCaptureStatus } from "./body-capture-layout";

type ReplayStatus = "idle" | "ready" | "replaying" | "completed";

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

export function BodyExperiment({
  onFallback,
  onBack,
}: {
  onFallback: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<BodyCaptureStatus>("idle");
  const [features, setFeatures] = useState<BodyMovementFeatures | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState("");
  const [capturedFrames, setCapturedFrames] = useState<BodyPoseFrame[]>([]);
  const [motionDiagnostic, setMotionDiagnostic] = useState<MotionExperimentDiagnostic | null>(null);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const replayAnimationRef = useRef<number | null>(null);
  const replayStartedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const framesRef = useRef<BodyPoseFrame[]>([]);
  const sampleAttemptsRef = useRef(0);
  const invalidFrameCountRef = useRef(0);

  const clearPoseCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPose(canvas, null);
  };

  const stopCapture = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  };

  const stopReplay = () => {
    if (replayAnimationRef.current !== null) cancelAnimationFrame(replayAnimationRef.current);
    replayAnimationRef.current = null;
  };

  useEffect(
    () => () => {
      stopCapture();
      stopReplay();
      framesRef.current = [];
    },
    [],
  );

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
    sampleAttemptsRef.current += 1;
    const detection = landmarker.detectForVideo(video, timestamp);
    const landmarks = detection.landmarks[0];
    if (landmarks) {
      const bodyLandmarks = toBodyLandmarks(landmarks);
      framesRef.current.push({ t: elapsed, landmarks: bodyLandmarks });
      drawPose(canvasRef.current!, bodyLandmarks);
    } else invalidFrameCountRef.current += 1;
    if (elapsed >= 3000) {
      const capturedFrames = [...framesRef.current];
      const captured = extractBodyMovementFeatures(framesRef.current);
      setCapturedFrames(capturedFrames);
      if (import.meta.env.DEV) {
        setMotionDiagnostic(
          createRealCaptureDiagnostics(
            capturedFrames,
            sampleAttemptsRef.current,
            invalidFrameCountRef.current,
          ),
        );
      }
      setReplayStatus(capturedFrames.length ? "ready" : "idle");
      setFeatures(captured);
      setStatus("captured");
      stopCapture();
      return;
    }
    animationRef.current = requestAnimationFrame(sample);
  };

  const startCapture = () => {
    if (status !== "ready" || !landmarkerRef.current) return;
    stopReplay();
    clearPoseCanvas();
    framesRef.current = [];
    setCapturedFrames([]);
    setMotionDiagnostic(null);
    sampleAttemptsRef.current = 0;
    invalidFrameCountRef.current = 0;
    setReplayStatus("idle");
    setFeatures(null);
    setResult(null);
    setError("");
    setStatus("capturing");
    startedAtRef.current = performance.now();
    animationRef.current = requestAnimationFrame(sample);
  };

  const retry = () => {
    stopCapture();
    stopReplay();
    clearPoseCanvas();
    framesRef.current = [];
    setCapturedFrames([]);
    setMotionDiagnostic(null);
    setReplayStatus("idle");
    setFeatures(null);
    setResult(null);
    setStatus("idle");
    void prepareCamera();
  };

  const replay = () => {
    if (!capturedFrames.length) return;
    stopReplay();
    setReplayStatus("replaying");
    replayStartedAtRef.current = performance.now();
    const renderReplay = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        stopReplay();
        return;
      }
      const elapsed = timestamp - replayStartedAtRef.current;
      const frameIndex = getReplayFrameIndex(capturedFrames, elapsed);
      if (frameIndex >= 0) drawPose(canvas, capturedFrames[frameIndex].landmarks);
      if (elapsed >= getReplayDurationMs(capturedFrames)) {
        const finalFrame = capturedFrames.at(-1);
        if (finalFrame) drawPose(canvas, finalFrame.landmarks);
        replayAnimationRef.current = null;
        setReplayStatus("completed");
        return;
      }
      replayAnimationRef.current = requestAnimationFrame(renderReplay);
    };
    replayAnimationRef.current = requestAnimationFrame(renderReplay);
  };

  const analyze = async () => {
    stopReplay();
    if (!features) return;
    const endpoint = import.meta.env.VITE_SENSORY_BRIDGE_API_URL as string | undefined;
    const provider = endpoint?.trim()
      ? createHttpSensoryBridgeProvider(endpoint.trim())
      : createFixtureSensoryBridgeProvider();
    const next = await runBodySemanticExperiment(features, provider);
    if ("error" in next) setError(next.error);
    else setResult(next);
  };

  const isDedicatedCaptureLayout = getBodyCaptureLayout(status) === "capture";

  if (result) {
    return (
      <main className="experience-screen" aria-labelledby="result-title">
        <nav className="experience-screen__nav" aria-label="画面の移動">
          <button className="icon-text-button" type="button" onClick={onBack}>
            <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>最初に戻る</span>
          </button>
          <span className="experience-screen__brand">Sake Sense</span>
        </nav>
        <Result result={result} onTryAgain={retry} />
      </main>
    );
  }

  return (
    <main
      className={`experience-screen${isDedicatedCaptureLayout ? " experience-screen--body-capture" : ""}`}
      aria-labelledby="body-experiment-title"
    >
      <nav className="experience-screen__nav" aria-label="画面の移動">
        <button className="icon-text-button" type="button" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>戻る</span>
        </button>
        <span className="experience-screen__brand">Sake Sense</span>
      </nav>
      {isDedicatedCaptureLayout && (
        <h1 id="body-experiment-title" className="screen-reader-only">
          この味、体でやってみてください
        </h1>
      )}
      {!isDedicatedCaptureLayout && (
        <header className="experience-screen__header">
          <h1 id="body-experiment-title">この味、体でやってみてください。</h1>
          <p>手だけでも、上半身でも大丈夫です。正解はありません。</p>
        </header>
      )}
      <section
        className={`body-capture-card${isDedicatedCaptureLayout ? " body-capture-card--dedicated" : " body-capture-card--setup"}`}
        aria-label="身体表現のカメラ入力"
      >
        {!isDedicatedCaptureLayout && (
          <div className="body-capture-card__copy">
            <h2>あなたの動きを見てみる</h2>
            <p>
              映像は端末内で処理され、保存・送信されません。3秒ほどの動きだけを一時的に取得します。
            </p>
          </div>
        )}
        <div className="body-camera" data-status={status} aria-live="polite">
          <video ref={videoRef} muted playsInline aria-label="身体表現のカメラプレビュー" />
          <canvas ref={canvasRef} width="640" height="360" aria-hidden="true" />
          {status === "ready" && (
            <div className="body-camera__guide">
              <strong>この味を、体で表現してみてください</strong>
              <span>手だけでも大丈夫です</span>
            </div>
          )}
          {status === "idle" && <span>カメラを準備してください</span>}
          {status === "capturing" && <span>動いてください…</span>}
          {status === "captured" && <span>動きを取得しました</span>}
        </div>
        {status === "captured" && (
          <button
            className="button button--secondary body-replay-button"
            type="button"
            onClick={replay}
          >
            <Play size={18} strokeWidth={1.8} aria-hidden="true" />
            動きをもう一度見る
          </button>
        )}
        {(status === "denied" || status === "unavailable") && (
          <p className="form-error" role="alert">
            {error || "カメラが利用できません。声や指の動きで表現する方法を試してください。"}
          </p>
        )}
        {features && (
          <section className="body-features" aria-labelledby="body-features-title">
            <h2 id="body-features-title">こんな動きでした</h2>
            <p className="body-features__replay-status" aria-live="polite">
              {replayStatus === "ready" && "リプレイには一時的に取得した骨格データだけを使います。"}
              {replayStatus === "replaying" && "あなたの動きをリプレイ中…"}
              {replayStatus === "completed" && "リプレイが完了しました。"}
            </p>
            <ul>
              {humanizeBodyFeatures(features)
                .slice(0, 4)
                .map((summary) => (
                  <li key={summary}>{summary}</li>
                ))}
            </ul>
            <p className="body-features__note">
              これらは観測した動きの特徴です。味そのものを判定したものではありません。
            </p>
          </section>
        )}
        {import.meta.env.DEV && motionDiagnostic && (
          <details className="debug-view" open={false}>
            <summary>Motion representation diagnostics (development only)</summary>
            <p>Derived metadata only; raw frames and landmark arrays are intentionally excluded.</p>
            <pre>{JSON.stringify(motionDiagnostic, null, 2)}</pre>
          </details>
        )}
        <div className="body-capture-card__actions" aria-live="polite">
          {status === "idle" && (
            <button className="button button--primary" type="button" onClick={prepareCamera}>
              <Camera size={19} strokeWidth={1.8} aria-hidden="true" />
              カメラを準備する
            </button>
          )}
          {status === "loading" && <span>カメラを準備しています…</span>}
          {status === "ready" && (
            <button className="button button--primary" type="button" onClick={startCapture}>
              3秒の動きを始める
            </button>
          )}
          {status === "capturing" && <span>身体表現を取得中…</span>}
          {status === "captured" && (
            <button className="button button--primary" type="button" onClick={analyze}>
              この動きから言葉を探す
            </button>
          )}
          {(status === "captured" || status === "denied" || status === "unavailable") && (
            <button className="icon-text-button" type="button" onClick={retry}>
              <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
              もう一度試す
            </button>
          )}
        </div>
        <button
          className="button button--secondary body-capture-card__fallback"
          type="button"
          onClick={onFallback}
        >
          声で表現する
        </button>
      </section>
    </main>
  );
}
