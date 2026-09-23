import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Pause, Play, RotateCcw, SwitchCamera } from "lucide-react";
import { runBodySemanticExperiment, type ExperimentResult } from "../../domain/experiment";
import {
  extractBodyMovementFeatures,
  humanizeBodyFeatures,
  type BodyLandmark,
  type BodyMovementFeatures,
  type BodyPoseFrame,
} from "../../domain/body";
import { getReplayDurationMs, getReplayFrameIndex } from "../../domain/body-replay";
import { createBodySegmentationLandmarker, isCameraSupported, toBodyLandmarks } from "./body-pose";
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
import {
  BODY_CAMERA_DEFAULT_FACING_MODE,
  BODY_CAMERA_PRESENTATION_MIRRORED,
  isCameraSwitchAccepted,
  isConfirmedCameraSwitchAvailable,
  isSameCameraDevice,
  shouldMirrorBodyCameraPresentation,
  type CameraFacingMode,
} from "./body-camera-presentation";
import { ExpressionTransform } from "../experiment/ExpressionTransform";
import {
  clampReplayPosition,
  getReplayControlAction,
  getReplayStartTimestamp,
  transitionReplayStatus,
  type ReplayStatus,
} from "./replay-control";
import {
  drawContour,
  drawContours,
  extractInnerContours,
  extractIsoContours,
  filterHoleComponents,
  findForegroundComponents,
  findEnclosedBackgroundComponents,
  INNER_CONTOUR_LINE_WIDTH_SCALE,
  INNER_CONTOUR_OPACITY,
  selectPrimaryContour,
  selectPrimaryForegroundComponent,
  createComponentMask,
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
import {
  createBodyHybridDisplaySnapshot,
  createBodyHybridReplayFrame,
  drawPoseGuidance,
  getBodyHybridReplayFrame,
  BODY_HYBRID_CONTOUR_COLOR,
  POSE_GUIDANCE_STYLES,
  type BodyHybridDisplaySnapshot,
  type BodyHybridReplayFrame,
} from "./body-pose-guidance";
import { BODY_POSE_CONNECTIONS } from "./body-pose-connections";

function isSegmentationSpikeEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("bodySegmentationSpike") === "1"
  );
}

const BODY_HYBRID_SEGMENTATION_ENABLED = true;

function drawPose(canvas: HTMLCanvasElement, landmarks: BodyLandmark[] | null): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  context.strokeStyle = "#e2b96c";
  context.fillStyle = "#f1cb84";
  context.lineWidth = 3;
  BODY_POSE_CONNECTIONS.forEach(([fromIndex, toIndex]) => {
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

function drawHybridGeometryCanvas(
  canvas: HTMLCanvasElement,
  geometry: Pick<BodyHybridDisplaySnapshot, "outerContour" | "innerContours"> | null,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!geometry) return;
  const drawContour = (points: readonly { x: number; y: number }[], opacity: number) => {
    if (points.length < 2) return;
    context.globalAlpha = opacity;
    context.beginPath();
    points.forEach((point, index) => {
      const x = (point.x / 320) * canvas.width;
      const y = (point.y / 160) * canvas.height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.stroke();
  };
  context.save();
  context.strokeStyle = BODY_HYBRID_CONTOUR_COLOR;
  context.lineWidth = Math.max(1, (canvas.width / 320) * 1.4);
  context.lineCap = "round";
  context.lineJoin = "round";
  drawContour(geometry.outerContour, 1);
  context.lineWidth = Math.max(1, (canvas.width / 320) * 1);
  geometry.innerContours.forEach((contour) => drawContour(contour, INNER_CONTOUR_OPACITY));
  context.restore();
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
  const [hybridReplayFrames, setHybridReplayFrames] = useState<BodyHybridReplayFrame[]>([]);
  const [hybridSnapshot, setHybridSnapshot] = useState<BodyHybridDisplaySnapshot | null>(null);
  const [motionDiagnostic, setMotionDiagnostic] = useState<MotionExperimentDiagnostic | null>(null);
  const [replayStatus, setReplayStatus] = useState<ReplayStatus>("initial");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<CameraFacingMode>(
    BODY_CAMERA_DEFAULT_FACING_MODE,
  );
  const [cameraPresentationMirrored, setCameraPresentationMirrored] = useState(
    BODY_CAMERA_PRESENTATION_MIRRORED,
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmentationCameraRef = useRef<HTMLCanvasElement>(null);
  const rawMaskRef = useRef<HTMLCanvasElement>(null);
  const thresholdMaskRef = useRef<HTMLCanvasElement>(null);
  const rawContourRef = useRef<HTMLCanvasElement>(null);
  const innerContourRef = useRef<HTMLCanvasElement>(null);
  const spatialContourRef = useRef<HTMLCanvasElement>(null);
  const temporalOnlyContourRef = useRef<HTMLCanvasElement>(null);
  const contourRef = useRef<HTMLCanvasElement>(null);
  const outerOnlyRef = useRef<HTMLCanvasElement>(null);
  const subtleArmsRef = useRef<HTMLCanvasElement>(null);
  const subtleTorsoRef = useRef<HTMLCanvasElement>(null);
  const subtleFaceRef = useRef<HTMLCanvasElement>(null);
  const contourStabilizerRef = useRef(new ContourStabilizer());
  const temporalOnlyStabilizerRef = useRef(new ContourStabilizer());
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const replayAnimationRef = useRef<number | null>(null);
  const replayStartedAtRef = useRef(0);
  const replayElapsedRef = useRef(0);
  const startedAtRef = useRef(0);
  const framesRef = useRef<BodyPoseFrame[]>([]);
  const hybridSnapshotRef = useRef<BodyHybridDisplaySnapshot | null>(null);
  const hybridReplayFramesRef = useRef<BodyHybridReplayFrame[]>([]);
  const sampleAttemptsRef = useRef(0);
  const invalidFrameCountRef = useRef(0);
  const segmentationFrameCountRef = useRef(0);
  const segmentationStartedAtRef = useRef(0);
  const contourResetCountRef = useRef(0);
  const cameraRequestIdRef = useRef(0);
  const activeCameraDeviceIdRef = useRef<string | undefined>(undefined);
  const activeCameraFacingModeRef = useRef<CameraFacingMode | undefined>(undefined);
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

  const stopCameraStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const closePoseLandmarker = () => {
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
  };

  const stopCapture = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    stopCameraStream();
    closePoseLandmarker();
    resetDisplayedContour();
  };

  const stopReplay = () => {
    if (replayAnimationRef.current !== null) cancelAnimationFrame(replayAnimationRef.current);
    replayAnimationRef.current = null;
  };

  const startReplayAt = (positionMs: number, action: "start" | "resume") => {
    if (!capturedFrames.length) return;
    stopReplay();
    const durationMs = getReplayDurationMs(capturedFrames);
    const nextPositionMs = clampReplayPosition(positionMs, durationMs);
    replayElapsedRef.current = nextPositionMs;
    setReplayStatus((current) => transitionReplayStatus(current, action));
    replayStartedAtRef.current = getReplayStartTimestamp(performance.now(), nextPositionMs);
    const renderReplay = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        stopReplay();
        return;
      }
      const elapsed = Math.min(Math.max(timestamp - replayStartedAtRef.current, 0), durationMs);
      replayElapsedRef.current = elapsed;
      const frameIndex = getReplayFrameIndex(capturedFrames, elapsed);
      if (frameIndex >= 0) {
        drawHybridGeometryCanvas(
          canvas,
          getBodyHybridReplayFrame(hybridReplayFrames, elapsed) ?? hybridSnapshot,
        );
        drawPoseGuidance(
          canvas.getContext("2d")!,
          capturedFrames[frameIndex].landmarks,
          "subtle-arms-torso-face",
          canvas.width,
          canvas.height,
        );
      }
      if (elapsed >= durationMs) {
        const finalFrame = capturedFrames.at(-1);
        if (finalFrame) {
          drawHybridGeometryCanvas(
            canvas,
            getBodyHybridReplayFrame(hybridReplayFrames, durationMs) ?? hybridSnapshot,
          );
          drawPoseGuidance(
            canvas.getContext("2d")!,
            finalFrame.landmarks,
            "subtle-arms-torso-face",
            canvas.width,
            canvas.height,
          );
        }
        replayAnimationRef.current = null;
        replayElapsedRef.current = durationMs;
        setReplayStatus((current) => transitionReplayStatus(current, "complete"));
        return;
      }
      replayAnimationRef.current = requestAnimationFrame(renderReplay);
    };
    replayAnimationRef.current = requestAnimationFrame(renderReplay);
  };

  const pauseReplay = () => {
    if (replayStatus !== "playing") return;
    const durationMs = getReplayDurationMs(capturedFrames);
    replayElapsedRef.current = clampReplayPosition(
      performance.now() - replayStartedAtRef.current,
      durationMs,
    );
    stopReplay();
    setReplayStatus((current) => transitionReplayStatus(current, "pause"));
  };

  const handleReplayControl = () => {
    const action = getReplayControlAction(replayStatus);
    if (action === "restart") startReplayAt(0, "start");
    else if (action === "pause") pauseReplay();
    else startReplayAt(replayElapsedRef.current, "resume");
  };

  const replayAriaLabel =
    replayStatus === "playing"
      ? "リプレイを一時停止"
      : replayStatus === "paused"
        ? "リプレイを再開"
        : replayStatus === "completed"
          ? "最初からリプレイ"
          : "リプレイを開始";

  useEffect(
    () => () => {
      cameraRequestIdRef.current += 1;
      stopCapture();
      stopReplay();
      framesRef.current = [];
    },
    [],
  );

  const resetCaptureStateForCameraSwitch = () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    stopReplay();
    clearPoseCanvas();
    framesRef.current = [];
    hybridReplayFramesRef.current = [];
    setCapturedFrames([]);
    setHybridReplayFrames([]);
    hybridSnapshotRef.current = null;
    setHybridSnapshot(null);
    setMotionDiagnostic(null);
    setSegmentationMetrics(null);
    replayElapsedRef.current = 0;
    setReplayStatus("initial");
    setFeatures(null);
    setResult(null);
    setIsAnalyzing(false);
    setError("");
    resetDisplayedContour();
  };

  const getVideoInputCount = async (): Promise<number> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput").length;
    } catch {
      return 0;
    }
  };

  const prepareCamera = async (requestedFacingMode: CameraFacingMode = cameraFacingMode) => {
    if (!isCameraSupported()) {
      setStatus("unavailable");
      return;
    }
    const requestId = ++cameraRequestIdRef.current;
    const previousFacingMode = cameraFacingMode;
    const previousPresentationMirrored = cameraPresentationMirrored;
    const previousDeviceId = activeCameraDeviceIdRef.current;
    const previousActualFacingMode = activeCameraFacingModeRef.current;
    setCameraFacingMode(requestedFacingMode);
    setStatus("loading");
    resetCaptureStateForCameraSwitch();
    stopCameraStream();
    closePoseLandmarker();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: requestedFacingMode } },
        audio: false,
      });
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video element is unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const track = stream.getVideoTracks()[0];
      let actualFacingMode: string | undefined;
      let deviceId: string | undefined;
      try {
        const settings = track?.getSettings?.();
        actualFacingMode = settings?.facingMode;
        deviceId = settings?.deviceId;
      } catch {
        actualFacingMode = undefined;
        deviceId = undefined;
      }
      const sameCameraDevice = isSameCameraDevice(previousDeviceId, deviceId);
      const switchAccepted = isCameraSwitchAccepted(
        previousFacingMode,
        requestedFacingMode,
        previousActualFacingMode,
        actualFacingMode,
        sameCameraDevice,
      );
      setCameraPresentationMirrored(
        switchAccepted
          ? shouldMirrorBodyCameraPresentation(actualFacingMode)
          : cameraPresentationMirrored,
      );
      const videoInputCount = await getVideoInputCount();
      setHasMultipleCameras(
        switchAccepted && isConfirmedCameraSwitchAvailable(videoInputCount, actualFacingMode),
      );
      if (!switchAccepted) setCameraFacingMode(previousFacingMode);
      activeCameraDeviceIdRef.current = deviceId;
      activeCameraFacingModeRef.current =
        actualFacingMode === "user" || actualFacingMode === "environment"
          ? actualFacingMode
          : undefined;
      const landmarker = await createBodySegmentationLandmarker();
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;
      setStatus("ready");
    } catch {
      if (requestId !== cameraRequestIdRef.current) return;
      stopCapture();
      setCameraFacingMode(previousFacingMode);
      setCameraPresentationMirrored(previousPresentationMirrored);
      setStatus("denied");
      setError("カメラを利用できませんでした。既存のEXP-002入力を使えます。");
    }
  };

  const switchCamera = () => {
    if (status === "capturing" || status === "loading") return;
    const nextFacingMode: CameraFacingMode = cameraFacingMode === "user" ? "environment" : "user";
    void prepareCamera(nextFacingMode);
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
    const bodyLandmarks = detection.landmarks[0] ? toBodyLandmarks(detection.landmarks[0]) : null;
    if (BODY_HYBRID_SEGMENTATION_ENABLED) {
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
        const foregroundComponentStartedAt = readSegmentationSpikeClock();
        const foregroundComponents = findForegroundComponents(binary);
        const primaryForeground = selectPrimaryForegroundComponent(foregroundComponents);
        const primaryForegroundMask = createComponentMask(
          mask.width,
          mask.height,
          primaryForeground,
        );
        const foregroundComponentMs = readSegmentationSpikeClock() - foregroundComponentStartedAt;
        const holeDetectionStartedAt = readSegmentationSpikeClock();
        const holes = findEnclosedBackgroundComponents(primaryForegroundMask);
        const holeDetectionMs = readSegmentationSpikeClock() - holeDetectionStartedAt;
        const holeFilteringStartedAt = readSegmentationSpikeClock();
        const acceptedHoles = filterHoleComponents(holes);
        const holeFilteringMs = readSegmentationSpikeClock() - holeFilteringStartedAt;
        const innerContourStartedAt = readSegmentationSpikeClock();
        const innerContours = extractInnerContours(primaryForegroundMask, acceptedHoles);
        const innerContourMs = readSegmentationSpikeClock() - innerContourStartedAt;
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
        if (innerContourRef.current) {
          const context = innerContourRef.current.getContext("2d");
          if (context) {
            drawContours(
              context,
              innerContours,
              innerContourRef.current.width,
              innerContourRef.current.height,
              `rgba(234, 215, 160, ${INNER_CONTOUR_OPACITY})`,
              mask.width,
              mask.height,
              INNER_CONTOUR_LINE_WIDTH_SCALE,
            );
          }
        }
        if (contourCanvas) {
          const context = contourCanvas.getContext("2d");
          if (context) {
            drawContours(
              context,
              stabilization.contour ? [stabilization.contour] : [],
              contourCanvas.width,
              contourCanvas.height,
              BODY_HYBRID_CONTOUR_COLOR,
              mask.width,
              mask.height,
            );
            drawContours(
              context,
              innerContours,
              contourCanvas.width,
              contourCanvas.height,
              `rgba(234, 215, 160, ${INNER_CONTOUR_OPACITY})`,
              mask.width,
              mask.height,
              INNER_CONTOUR_LINE_WIDTH_SCALE,
              false,
            );
          }
        }
        const liveCanvas = canvasRef.current;
        if (liveCanvas) {
          const context = liveCanvas.getContext("2d");
          if (context) {
            context.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
            drawContours(
              context,
              stabilization.contour ? [stabilization.contour] : [],
              liveCanvas.width,
              liveCanvas.height,
              BODY_HYBRID_CONTOUR_COLOR,
              mask.width,
              mask.height,
            );
            drawContours(
              context,
              innerContours,
              liveCanvas.width,
              liveCanvas.height,
              `rgba(234, 215, 160, ${INNER_CONTOUR_OPACITY})`,
              mask.width,
              mask.height,
              INNER_CONTOUR_LINE_WIDTH_SCALE,
              false,
            );
            drawPoseGuidance(
              context,
              bodyLandmarks,
              "subtle-arms-torso-face",
              liveCanvas.width,
              liveCanvas.height,
            );
          }
        }
        hybridSnapshotRef.current = createBodyHybridDisplaySnapshot(
          stabilization.contour ?? [],
          innerContours,
          bodyLandmarks,
          mask.width,
          mask.height,
        );
        hybridReplayFramesRef.current.push(
          createBodyHybridReplayFrame(
            elapsed,
            stabilization.contour ?? [],
            innerContours,
            mask.width,
            mask.height,
          ),
        );
        const drawComparisonVariant = (
          ref: typeof contourRef,
          poseVariant?: "subtle-arms" | "subtle-arms-torso" | "subtle-arms-torso-face",
        ) => {
          const canvas = ref.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) return;
          drawContours(
            context,
            stabilization.contour ? [stabilization.contour] : [],
            canvas.width,
            canvas.height,
            BODY_HYBRID_CONTOUR_COLOR,
            mask.width,
            mask.height,
          );
          drawContours(
            context,
            innerContours,
            canvas.width,
            canvas.height,
            `rgba(234, 215, 160, ${INNER_CONTOUR_OPACITY})`,
            mask.width,
            mask.height,
            INNER_CONTOUR_LINE_WIDTH_SCALE,
            false,
          );
          if (poseVariant) {
            drawPoseGuidance(context, bodyLandmarks, poseVariant, canvas.width, canvas.height);
          }
        };
        if (outerOnlyRef.current) {
          const context = outerOnlyRef.current.getContext("2d");
          if (context)
            drawContours(
              context,
              stabilization.contour ? [stabilization.contour] : [],
              outerOnlyRef.current.width,
              outerOnlyRef.current.height,
              BODY_HYBRID_CONTOUR_COLOR,
              mask.width,
              mask.height,
            );
        }
        drawComparisonVariant(subtleArmsRef, "subtle-arms");
        drawComparisonVariant(subtleTorsoRef, "subtle-arms-torso");
        drawComparisonVariant(subtleFaceRef, "subtle-arms-torso-face");
        segmentationFrameCountRef.current += 1;
        const elapsedMs = readSegmentationSpikeClock() - segmentationStartedAtRef.current;
        if (segmentationSpike) {
          setSegmentationMetrics({
            frameCount: segmentationFrameCountRef.current,
            elapsedMs,
            approximateFps:
              elapsedMs > 0 ? (segmentationFrameCountRef.current * 1000) / elapsedMs : 0,
            poseMaskMs,
            thresholdMs,
            foregroundComponentMs,
            foregroundComponentCount: foregroundComponents.length,
            preprocessingMs: 0,
            contourMs,
            selectionMs,
            simplificationMs,
            smoothingMs,
            resamplingMs,
            spatialAveragingMs,
            holeDetectionMs,
            holeFilteringMs,
            innerContourMs,
            innerContourCount: innerContours.length,
            acceptedHoleArea: acceptedHoles.reduce((area, hole) => area + hole.area, 0),
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
        }
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
        if (innerContourRef.current) {
          const context = innerContourRef.current.getContext("2d");
          if (context)
            drawContours(
              context,
              [],
              innerContourRef.current.width,
              innerContourRef.current.height,
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
        const liveCanvas = canvasRef.current;
        if (liveCanvas)
          liveCanvas.getContext("2d")?.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
        [outerOnlyRef, subtleArmsRef, subtleTorsoRef, subtleFaceRef].forEach((ref) => {
          const context = ref.current?.getContext("2d");
          if (context && ref.current)
            context.clearRect(0, 0, ref.current.width, ref.current.height);
        });
      }
    }
    if (bodyLandmarks) {
      framesRef.current.push({ t: elapsed, landmarks: bodyLandmarks });
      if (!BODY_HYBRID_SEGMENTATION_ENABLED) drawPose(canvasRef.current!, bodyLandmarks);
    } else invalidFrameCountRef.current += 1;
    detection.close();
    if (elapsed >= 3000) {
      const capturedFrames = [...framesRef.current];
      const captured = extractBodyMovementFeatures(framesRef.current);
      setCapturedFrames(capturedFrames);
      setHybridReplayFrames([...hybridReplayFramesRef.current]);
      setHybridSnapshot(hybridSnapshotRef.current);
      if (import.meta.env.DEV) {
        setMotionDiagnostic(
          createRealCaptureDiagnostics(
            capturedFrames,
            sampleAttemptsRef.current,
            invalidFrameCountRef.current,
          ),
        );
      }
      replayElapsedRef.current = 0;
      setReplayStatus("initial");
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
    hybridReplayFramesRef.current = [];
    setCapturedFrames([]);
    setHybridReplayFrames([]);
    hybridSnapshotRef.current = null;
    setHybridSnapshot(null);
    setMotionDiagnostic(null);
    sampleAttemptsRef.current = 0;
    invalidFrameCountRef.current = 0;
    segmentationFrameCountRef.current = 0;
    contourResetCountRef.current = 0;
    segmentationStartedAtRef.current = performance.now();
    setSegmentationMetrics(null);
    replayElapsedRef.current = 0;
    setReplayStatus("initial");
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
    hybridReplayFramesRef.current = [];
    setCapturedFrames([]);
    setHybridReplayFrames([]);
    hybridSnapshotRef.current = null;
    setHybridSnapshot(null);
    setMotionDiagnostic(null);
    replayElapsedRef.current = 0;
    setReplayStatus("initial");
    setFeatures(null);
    setResult(null);
    setIsAnalyzing(false);
    setStatus("idle");
    void prepareCamera();
  };

  const analyze = async () => {
    if (replayStatus === "playing") pauseReplay();
    else stopReplay();
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
              frames={[]}
              hybridSnapshot={hybridSnapshot}
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
        <div
          className="body-camera"
          data-status={status}
          data-presentation-mirrored={cameraPresentationMirrored}
          data-camera-facing={cameraFacingMode}
          aria-live="polite"
        >
          <video ref={videoRef} muted playsInline aria-label="身体表現のカメラプレビュー" />
          <canvas ref={canvasRef} width="640" height="360" aria-hidden="true" />

          <nav className="body-camera__top-overlay" aria-label="画面の移動">
            <button className="body-camera__back" type="button" onClick={onBack}>
              <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
              <span>戻る</span>
            </button>
          </nav>
          {hasMultipleCameras && (status === "ready" || status === "captured") && (
            <button
              className="body-camera__switch"
              type="button"
              onClick={switchCamera}
              aria-label={
                cameraFacingMode === "user" ? "背面カメラに切り替え" : "前面カメラに切り替え"
              }
            >
              <SwitchCamera size={19} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
          {status === "ready" && (
            <div className="body-camera__guide">
              <span>動きで表してみてください</span>
            </div>
          )}
          {status === "captured" && (
            <button
              className="body-camera__replay-control"
              type="button"
              onClick={handleReplayControl}
              aria-label={replayAriaLabel}
            >
              {replayStatus === "playing" ? (
                <Pause size={24} strokeWidth={1.8} aria-hidden="true" />
              ) : replayStatus === "paused" ? (
                <Play size={24} strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <RotateCcw size={24} strokeWidth={1.8} aria-hidden="true" />
              )}
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
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => void prepareCamera()}
                  >
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
                <canvas ref={innerContourRef} width="320" height="180" />
                <figcaption>Detected inner contours</figcaption>
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
                <figcaption>Outer + inner contours</figcaption>
              </figure>
              <figure>
                <canvas ref={outerOnlyRef} width="320" height="180" />
                <figcaption>Outer contour only (reference)</figcaption>
              </figure>
              <figure>
                <canvas ref={subtleArmsRef} width="320" height="180" />
                <figcaption>
                  Outer + inner + {POSE_GUIDANCE_STYLES["subtle-arms"].label} · opacity{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms"].opacity} · width{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms"].strokeWidth}
                </figcaption>
              </figure>
              <figure>
                <canvas ref={subtleTorsoRef} width="320" height="180" />
                <figcaption>
                  Outer + inner + {POSE_GUIDANCE_STYLES["subtle-arms-torso"].label} · opacity{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms-torso"].opacity} · width{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms-torso"].strokeWidth}
                </figcaption>
              </figure>
              <figure>
                <canvas ref={subtleFaceRef} width="320" height="180" />
                <figcaption>
                  Outer + inner + {POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].label} · opacity{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].opacity} · face opacity{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].faceOpacity} · width{" "}
                  {POSE_GUIDANCE_STYLES["subtle-arms-torso-face"].faceStrokeWidth}
                </figcaption>
              </figure>
            </div>
            {segmentationMetrics && (
              <pre className="body-segmentation-spike__metrics">
                {`Pose+mask: ${segmentationMetrics.poseMaskMs.toFixed(1)} ms\nThreshold: ${segmentationMetrics.thresholdMs.toFixed(1)} ms\nForeground components: ${segmentationMetrics.foregroundComponentMs.toFixed(1)} ms (${segmentationMetrics.foregroundComponentCount})\nHoles: ${segmentationMetrics.holeDetectionMs.toFixed(1)} ms + ${segmentationMetrics.holeFilteringMs.toFixed(1)} ms\nInner contours: ${segmentationMetrics.innerContourMs.toFixed(1)} ms (${segmentationMetrics.innerContourCount}, area ${segmentationMetrics.acceptedHoleArea})\nPreprocess: ${segmentationMetrics.preprocessingMs.toFixed(1)} ms\nContour: ${segmentationMetrics.contourMs.toFixed(1)} ms\nSelect: ${segmentationMetrics.selectionMs.toFixed(1)} ms\nSimplify: ${segmentationMetrics.simplificationMs.toFixed(1)} ms\nSpatial smooth: ${segmentationMetrics.smoothingMs.toFixed(1)} ms\nResample: ${segmentationMetrics.resamplingMs.toFixed(1)} ms\nAverage: ${segmentationMetrics.spatialAveragingMs.toFixed(1)} ms\nWinding: ${segmentationMetrics.windingMs.toFixed(1)} ms\nAlign: ${segmentationMetrics.alignmentMs.toFixed(1)} ms\nTemporal: ${segmentationMetrics.temporalSmoothingMs.toFixed(1)} ms\nPoints: ${segmentationMetrics.rawContourPointCount} -> ${segmentationMetrics.finalContourPointCount} -> ${segmentationMetrics.stabilizedContourPointCount}\nOffset: ${segmentationMetrics.alignmentOffset}\nCorrection: ${segmentationMetrics.averageTemporalCorrectionDistance.toFixed(2)}\nResets: ${segmentationMetrics.resetCount}\nApprox FPS: ${segmentationMetrics.approximateFps.toFixed(1)}\nFrames: ${segmentationMetrics.frameCount}`}
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
          <ExpressionTransform
            mode="body"
            features={features}
            frames={[]}
            hybridSnapshot={hybridSnapshot}
          />
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
