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
import {
  createBodyPoseLandmarker,
  createBodySegmentationSpikeLandmarker,
  isCameraSupported,
  toBodyLandmarks,
} from "./body-pose";
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
import { ExpressionTransform } from "../experiment/ExpressionTransform";
import {
  drawContour,
  extractIsoContours,
  selectPrimaryContour,
  simplifyContour,
  smoothContour,
  drawRawMask,
  drawThresholdedMask,
  averageClosedContour,
  ContourStabilizer,
  ensureContourWinding,
  resampleClosedContour,
  SEGMENTATION_THRESHOLD,
  readSegmentationSpikeClock,
  thresholdSegmentationMask,
  RAW_MASK_ISO_LEVEL,
  type SegmentationSpikeMetrics,
} from "./segmentation-mask-spike";

type ReplayStatus = "idle" | "ready" | "replaying" | "completed";

function isSegmentationSpikeEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("bodySegmentationSpike") === "1"
  );
}

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmentationCameraRef = useRef<HTMLCanvasElement>(null);
  const rawMaskRef = useRef<HTMLCanvasElement>(null);
  const thresholdMaskRef = useRef<HTMLCanvasElement>(null);
  const rawContourRef = useRef<HTMLCanvasElement>(null);
  const spatialContourRef = useRef<HTMLCanvasElement>(null);
  const temporalOnlyContourRef = useRef<HTMLCanvasElement>(null);
  const contourRef = useRef<HTMLCanvasElement>(null);
  const contourStabilizerRef = useRef(new ContourStabilizer());
  const temporalOnlyStabilizerRef = useRef(new ContourStabilizer());
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const replayAnimationRef = useRef<number | null>(null);
  const replayStartedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const framesRef = useRef<BodyPoseFrame[]>([]);
  const sampleAttemptsRef = useRef(0);
  const invalidFrameCountRef = useRef(0);
  const segmentationFrameCountRef = useRef(0);
  const segmentationStartedAtRef = useRef(0);
  const contourResetCountRef = useRef(0);
  const [segmentationMetrics, setSegmentationMetrics] = useState<SegmentationSpikeMetrics | null>(
    null,
  );
  const segmentationSpike = isSegmentationSpikeEnabled();

  const resetDisplayedContour = () => {
    contourStabilizerRef.current.reset();
    temporalOnlyStabilizerRef.current.reset();
  };

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
    resetDisplayedContour();
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
    resetDisplayedContour();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video element is unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      landmarkerRef.current = await (segmentationSpike
        ? createBodySegmentationSpikeLandmarker()
        : createBodyPoseLandmarker());
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
    const poseStartedAt = readSegmentationSpikeClock();
    const detection = landmarker.detectForVideo(video, timestamp);
    const poseMaskMs = readSegmentationSpikeClock() - poseStartedAt;
    if (segmentationSpike) {
      const cameraCanvas = segmentationCameraRef.current;
      if (cameraCanvas) {
        cameraCanvas
          .getContext("2d")
          ?.drawImage(video, 0, 0, cameraCanvas.width, cameraCanvas.height);
      }
      const mask = detection.segmentationMasks?.[0];
      if (mask) {
        const values = mask.getAsFloat32Array();
        const rawCanvas = rawMaskRef.current;
        const thresholdCanvas = thresholdMaskRef.current;
        const contourCanvas = contourRef.current;
        if (rawCanvas && (rawCanvas.width !== mask.width || rawCanvas.height !== mask.height)) {
          rawCanvas.width = mask.width;
          rawCanvas.height = mask.height;
        }
        if (
          thresholdCanvas &&
          (thresholdCanvas.width !== mask.width || thresholdCanvas.height !== mask.height)
        ) {
          thresholdCanvas.width = mask.width;
          thresholdCanvas.height = mask.height;
        }
        if (rawCanvas) {
          const context = rawCanvas.getContext("2d");
          if (context) drawRawMask(context, values, mask.width, mask.height);
        }
        const thresholdStartedAt = readSegmentationSpikeClock();
        const binary = thresholdSegmentationMask(values, mask.width, mask.height);
        const thresholdMs = readSegmentationSpikeClock() - thresholdStartedAt;
        if (thresholdCanvas) {
          const context = thresholdCanvas.getContext("2d");
          if (context) drawThresholdedMask(context, binary);
        }
        const contourStartedAt = readSegmentationSpikeClock();
        const contours = extractIsoContours(values, mask.width, mask.height, RAW_MASK_ISO_LEVEL);
        const contourMs = readSegmentationSpikeClock() - contourStartedAt;
        const selectionStartedAt = readSegmentationSpikeClock();
        const primaryContour = selectPrimaryContour(contours);
        const selectionMs = readSegmentationSpikeClock() - selectionStartedAt;
        const simplificationStartedAt = readSegmentationSpikeClock();
        const simplifiedContour = primaryContour ? simplifyContour(primaryContour) : null;
        const simplificationMs = readSegmentationSpikeClock() - simplificationStartedAt;
        const smoothingStartedAt = readSegmentationSpikeClock();
        const finalContour = simplifiedContour ? smoothContour(simplifiedContour) : null;
        const smoothingMs = readSegmentationSpikeClock() - smoothingStartedAt;
        const resamplingStartedAt = readSegmentationSpikeClock();
        const resampledContour = finalContour ? resampleClosedContour(finalContour) : [];
        const resamplingMs = readSegmentationSpikeClock() - resamplingStartedAt;
        const spatialAveragingStartedAt = readSegmentationSpikeClock();
        const spatialAveragedContour = averageClosedContour(resampledContour);
        const spatialAveragingMs = readSegmentationSpikeClock() - spatialAveragingStartedAt;
        const windingStartedAt = readSegmentationSpikeClock();
        const preparedContour = ensureContourWinding(spatialAveragedContour, "clockwise");
        const windingMs = readSegmentationSpikeClock() - windingStartedAt;
        const temporalOnlyContour = temporalOnlyStabilizerRef.current.update(
          ensureContourWinding(resampledContour, "clockwise"),
        );
        const stabilization = contourStabilizerRef.current.update(preparedContour);
        if (stabilization.reset) contourResetCountRef.current += 1;
        if (rawContourRef.current) {
          const context = rawContourRef.current.getContext("2d");
          if (context) {
            drawContour(
              context,
              primaryContour,
              rawContourRef.current.width,
              rawContourRef.current.height,
              "rgba(234, 215, 160, 0.7)",
              mask.width,
              mask.height,
            );
          }
        }
        if (spatialContourRef.current) {
          const context = spatialContourRef.current.getContext("2d");
          if (context) {
            drawContour(
              context,
              spatialAveragedContour,
              spatialContourRef.current.width,
              spatialContourRef.current.height,
              "rgba(234, 215, 160, 0.82)",
              mask.width,
              mask.height,
            );
          }
        }
        if (temporalOnlyContourRef.current) {
          const context = temporalOnlyContourRef.current.getContext("2d");
          if (context) {
            drawContour(
              context,
              temporalOnlyContour.contour,
              temporalOnlyContourRef.current.width,
              temporalOnlyContourRef.current.height,
              "rgba(234, 215, 160, 0.9)",
              mask.width,
              mask.height,
            );
          }
        }
        if (contourCanvas) {
          const context = contourCanvas.getContext("2d");
          if (context) {
            drawContour(
              context,
              stabilization.contour,
              contourCanvas.width,
              contourCanvas.height,
              "#ead7a0",
              mask.width,
              mask.height,
            );
          }
        }
        segmentationFrameCountRef.current += 1;
        const elapsedMs = readSegmentationSpikeClock() - segmentationStartedAtRef.current;
        setSegmentationMetrics({
          frameCount: segmentationFrameCountRef.current,
          elapsedMs,
          approximateFps:
            elapsedMs > 0 ? (segmentationFrameCountRef.current * 1000) / elapsedMs : 0,
          poseMaskMs,
          thresholdMs,
          preprocessingMs: 0,
          contourMs,
          selectionMs,
          simplificationMs,
          smoothingMs,
          resamplingMs,
          spatialAveragingMs,
          windingMs,
          alignmentMs: stabilization.alignmentMs,
          temporalSmoothingMs: stabilization.temporalSmoothingMs,
          rawContourPointCount: primaryContour?.length ?? 0,
          stabilizedContourPointCount: stabilization.contour?.length ?? 0,
          alignmentOffset: stabilization.alignmentOffset,
          averageTemporalCorrectionDistance: stabilization.averageCorrectionDistance,
          resetCount: contourResetCountRef.current,
          finalContourPointCount: finalContour?.length ?? 0,
        });
      } else {
        const temporalOnlyContour = temporalOnlyStabilizerRef.current.update(null);
        const stabilization = contourStabilizerRef.current.update(null);
        if (stabilization.reset) contourResetCountRef.current += 1;
        if (rawContourRef.current) {
          const context = rawContourRef.current.getContext("2d");
          if (context)
            drawContour(context, null, rawContourRef.current.width, rawContourRef.current.height);
        }
        if (spatialContourRef.current) {
          const context = spatialContourRef.current.getContext("2d");
          if (context)
            drawContour(
              context,
              null,
              spatialContourRef.current.width,
              spatialContourRef.current.height,
            );
        }
        if (temporalOnlyContourRef.current) {
          const context = temporalOnlyContourRef.current.getContext("2d");
          if (context)
            drawContour(
              context,
              temporalOnlyContour.contour,
              temporalOnlyContourRef.current.width,
              temporalOnlyContourRef.current.height,
            );
        }
        if (contourRef.current) {
          const context = contourRef.current.getContext("2d");
          if (context)
            drawContour(
              context,
              stabilization.contour,
              contourRef.current.width,
              contourRef.current.height,
            );
        }
      }
    }
    const landmarks = detection.landmarks[0];
    if (landmarks) {
      const bodyLandmarks = toBodyLandmarks(landmarks);
      framesRef.current.push({ t: elapsed, landmarks: bodyLandmarks });
      drawPose(canvasRef.current!, bodyLandmarks);
    } else invalidFrameCountRef.current += 1;
    detection.close();
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
    resetDisplayedContour();
    stopReplay();
    clearPoseCanvas();
    framesRef.current = [];
    setCapturedFrames([]);
    setMotionDiagnostic(null);
    sampleAttemptsRef.current = 0;
    invalidFrameCountRef.current = 0;
    segmentationFrameCountRef.current = 0;
    contourResetCountRef.current = 0;
    segmentationStartedAtRef.current = performance.now();
    setSegmentationMetrics(null);
    setReplayStatus("idle");
    setFeatures(null);
    setResult(null);
    setIsAnalyzing(false);
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
    setIsAnalyzing(false);
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
    if (!features || isAnalyzing) return;
    setError("");
    setIsAnalyzing(true);
    const endpoint = import.meta.env.VITE_SENSORY_BRIDGE_API_URL as string | undefined;
    const provider = endpoint?.trim()
      ? createHttpSensoryBridgeProvider(endpoint.trim())
      : createFixtureSensoryBridgeProvider();
    try {
      const next = await runBodySemanticExperiment(features, provider);
      if ("error" in next) setError(next.error);
      else setResult(next);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const bodyCaptureLayout = getBodyCaptureLayout(status);

  if (status === "captured" && features && (isAnalyzing || result)) {
    return (
      <main
        className={`experience-screen ${result ? "experience-screen--body-result" : "experience-screen--body-transform"}`}
        aria-labelledby={result ? "result-title" : "body-transform-title"}
      >
        <div className={`body-result-transition${result ? " body-result-transition--result" : ""}`}>
          <div
            className="body-result-transition__waiting"
            aria-hidden={result ? "true" : undefined}
          >
            <ExpressionTransform
              mode="body"
              features={features}
              frames={capturedFrames}
              presentation="body-screen"
              decorative={Boolean(result)}
            />
          </div>
          {result && (
            <div className="body-result-transition__content">
              <nav className="experience-screen__nav" aria-label="画面の移動">
                <button className="icon-text-button" type="button" onClick={onBack}>
                  <ArrowLeft size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>最初に戻る</span>
                </button>
                <span className="experience-screen__brand">Sake Sense</span>
              </nav>
              <Result result={result} onTryAgain={retry} />
            </div>
          )}
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="experience-screen" aria-labelledby="result-title">
        <Result result={result} onTryAgain={retry} />
      </main>
    );
  }

  return (
    <main
      className={`experience-screen experience-screen--body-capture experience-screen--${bodyCaptureLayout.shell}${isAnalyzing ? " experience-screen--analyzing" : ""}`}
      data-capture-status={status}
      aria-labelledby="body-experiment-title"
    >
      <h1 id="body-experiment-title" className="screen-reader-only">
        この味、体でやってみてください
      </h1>
      <section
        className="body-capture-card body-capture-card--dedicated"
        data-status={status}
        data-analysis-state={isAnalyzing ? "analyzing" : "idle"}
        aria-label="身体表現のカメラ入力"
      >
        <div className="body-camera" data-status={status} aria-live="polite">
          <video ref={videoRef} muted playsInline aria-label="身体表現のカメラプレビュー" />
          <canvas ref={canvasRef} width="640" height="360" aria-hidden="true" />

          <nav className="body-camera__top-overlay" aria-label="画面の移動">
            <button className="body-camera__back" type="button" onClick={onBack}>
              <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>戻る</span>
            </button>
          </nav>
          {status === "ready" && (
            <div className="body-camera__guide">
              <span>動きで表してみてください</span>
            </div>
          )}
          {status === "captured" && (
            <button
              className="body-camera__replay-control"
              type="button"
              onClick={replay}
              aria-label="動きをもう一度見る"
            >
              <Play size={24} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          {status !== "captured" && (
            <div className="body-camera__bottom-overlay" aria-live="polite">
              {(status === "idle" ||
                status === "loading" ||
                status === "denied" ||
                status === "unavailable") && (
                <p className="body-capture-card__privacy-note">
                  映像は端末内で処理され、保存・送信されません。
                </p>
              )}
              {(status === "denied" || status === "unavailable") && (
                <p className="form-error" role="alert">
                  {error || "カメラが利用できません。別の方法で表現する方法を試してください。"}
                </p>
              )}
              <div className="body-capture-card__actions">
                {status === "idle" && (
                  <button className="button button--primary" type="button" onClick={prepareCamera}>
                    <Camera size={19} strokeWidth={1.8} aria-hidden="true" />
                    カメラを準備する
                  </button>
                )}
                {status === "loading" && <span>カメラを準備しています…</span>}
                {status === "ready" && (
                  <div className="body-record-control">
                    <button
                      className="body-record-control__button"
                      type="button"
                      onClick={startCapture}
                      aria-label="3秒の動きを始める"
                    >
                      <span aria-hidden="true" />
                    </button>
                    <span className="body-record-control__label">3秒の動きを始める</span>
                  </div>
                )}
                {status === "capturing" && (
                  <div className="body-record-control body-record-control--recording">
                    <span className="body-record-control__button" aria-hidden="true">
                      <span />
                    </span>
                    <span className="body-record-control__label">記録中…</span>
                  </div>
                )}
                {(status === "denied" || status === "unavailable") && (
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
            </div>
          )}
        </div>
        {segmentationSpike && (
          <section className="body-segmentation-spike" aria-label="Body segmentation mask spike">
            <p className="body-segmentation-spike__note">
              Development-only mask preview · threshold {SEGMENTATION_THRESHOLD}
            </p>
            <div className="body-segmentation-spike__grid">
              <figure>
                <canvas ref={segmentationCameraRef} width="320" height="180" />
                <figcaption>Camera</figcaption>
              </figure>
              <figure>
                <canvas ref={rawMaskRef} width="320" height="180" />
                <figcaption>Raw mask</figcaption>
              </figure>
              <figure>
                <canvas ref={thresholdMaskRef} width="320" height="180" />
                <figcaption>Thresholded mask</figcaption>
              </figure>
              <figure>
                <canvas ref={rawContourRef} width="320" height="180" />
                <figcaption>Raw traced contour</figcaption>
              </figure>
              <figure>
                <canvas ref={spatialContourRef} width="320" height="180" />
                <figcaption>Spatially smoothed contour</figcaption>
              </figure>
              <figure>
                <canvas ref={temporalOnlyContourRef} width="320" height="180" />
                <figcaption>Temporal-only contour</figcaption>
              </figure>
              <figure>
                <canvas ref={contourRef} width="320" height="180" />
                <figcaption>Temporally stabilized contour</figcaption>
              </figure>
            </div>
            {segmentationMetrics && (
              <pre className="body-segmentation-spike__metrics">
                {`Pose+mask: ${segmentationMetrics.poseMaskMs.toFixed(1)} ms\nThreshold: ${segmentationMetrics.thresholdMs.toFixed(1)} ms\nPreprocess: ${segmentationMetrics.preprocessingMs.toFixed(1)} ms\nContour: ${segmentationMetrics.contourMs.toFixed(1)} ms\nSelect: ${segmentationMetrics.selectionMs.toFixed(1)} ms\nSimplify: ${segmentationMetrics.simplificationMs.toFixed(1)} ms\nSpatial smooth: ${segmentationMetrics.smoothingMs.toFixed(1)} ms\nResample: ${segmentationMetrics.resamplingMs.toFixed(1)} ms\nAverage: ${segmentationMetrics.spatialAveragingMs.toFixed(1)} ms\nWinding: ${segmentationMetrics.windingMs.toFixed(1)} ms\nAlign: ${segmentationMetrics.alignmentMs.toFixed(1)} ms\nTemporal: ${segmentationMetrics.temporalSmoothingMs.toFixed(1)} ms\nPoints: ${segmentationMetrics.rawContourPointCount} -> ${segmentationMetrics.finalContourPointCount} -> ${segmentationMetrics.stabilizedContourPointCount}\nOffset: ${segmentationMetrics.alignmentOffset}\nCorrection: ${segmentationMetrics.averageTemporalCorrectionDistance.toFixed(2)}\nResets: ${segmentationMetrics.resetCount}\nApprox FPS: ${segmentationMetrics.approximateFps.toFixed(1)}\nFrames: ${segmentationMetrics.frameCount}`}
              </pre>
            )}
            <p className="body-segmentation-spike__poses">
              Try: neutral · arms open · one arm up · twist · upper-body-only · edge movement
            </p>
          </section>
        )}
        {!isAnalyzing && (features || (import.meta.env.DEV && motionDiagnostic)) && (
          <div className="body-capture-details">
            {features && (
              <section className="body-features" aria-labelledby="body-features-title">
                <h2 id="body-features-title">こんな動きでした</h2>
                <p className="body-features__replay-status" aria-live="polite">
                  {replayStatus === "ready" &&
                    "リプレイには一時的に取得した骨格データだけを使います。"}
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
                <p>
                  Derived metadata only; raw frames and landmark arrays are intentionally excluded.
                </p>
                <pre>{JSON.stringify(motionDiagnostic, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
        {status === "captured" && isAnalyzing && features && (
          <ExpressionTransform mode="body" features={features} frames={capturedFrames} />
        )}
        {status === "captured" && !isAnalyzing && (
          <section className="body-capture-review-actions" aria-label="記録した動きの操作">
            <button className="button button--primary" type="button" onClick={analyze}>
              この動きから言葉を探す
            </button>
            <button className="icon-text-button" type="button" onClick={retry}>
              <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
              もう一度やってみる
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
