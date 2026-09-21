import type { BodyLandmark } from "../../domain/body";

export const BODY_RENDER_VISIBILITY_THRESHOLD = 0.35;
export const BODY_RENDER_SMOOTHING_ALPHA = 0.25;

export type BodyPoint = { x: number; y: number };

export type BodyCurve = {
  start: BodyPoint;
  control: BodyPoint;
  end: BodyPoint;
};

export type CurvedBodyGeometry = {
  head: { center: BodyPoint; radiusX: number; radiusY: number } | null;
  shoulders: BodyCurve | null;
  leftArm: BodyCurve | null;
  rightArm: BodyCurve | null;
  leftTorso: BodyCurve | null;
  rightTorso: BodyCurve | null;
  hips: BodyCurve | null;
  wrists: BodyPoint[];
};

function visiblePoint(landmarks: BodyLandmark[], index: number): BodyPoint | null {
  const landmark = landmarks[index];
  if (!landmark || (landmark.visibility ?? 1) < BODY_RENDER_VISIBILITY_THRESHOLD) return null;
  return { x: landmark.x, y: landmark.y };
}

function curve(
  start: BodyPoint | null,
  control: BodyPoint | null,
  end: BodyPoint | null,
): BodyCurve | null {
  return start && control && end ? { start, control, end } : null;
}

export function getCurvedBodyGeometry(landmarks: BodyLandmark[]): CurvedBodyGeometry {
  const leftShoulder = visiblePoint(landmarks, 11);
  const rightShoulder = visiblePoint(landmarks, 12);
  const leftElbow = visiblePoint(landmarks, 13);
  const rightElbow = visiblePoint(landmarks, 14);
  const leftWrist = visiblePoint(landmarks, 15);
  const rightWrist = visiblePoint(landmarks, 16);
  const leftHip = visiblePoint(landmarks, 23);
  const rightHip = visiblePoint(landmarks, 24);

  const shoulderCenter =
    leftShoulder && rightShoulder
      ? { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
      : null;
  const hipCenter =
    leftHip && rightHip
      ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
      : null;
  const nose = visiblePoint(landmarks, 0);
  const leftEar = visiblePoint(landmarks, 7);
  const rightEar = visiblePoint(landmarks, 8);
  const earWidth = leftEar && rightEar ? Math.abs(rightEar.x - leftEar.x) : 0;
  const headCenter =
    leftEar && rightEar && nose
      ? { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 - earWidth * 0.12 }
      : null;

  return {
    head:
      headCenter && earWidth > 0
        ? { center: headCenter, radiusX: earWidth * 0.65, radiusY: earWidth * 0.82 }
        : null,
    shoulders: curve(
      leftShoulder,
      shoulderCenter && { x: shoulderCenter.x, y: shoulderCenter.y - 0.018 },
      rightShoulder,
    ),
    leftArm: curve(leftShoulder, leftElbow, leftWrist),
    rightArm: curve(rightShoulder, rightElbow, rightWrist),
    leftTorso: curve(
      leftShoulder,
      leftShoulder && leftHip && { x: leftHip.x - 0.015, y: (leftShoulder.y + leftHip.y) / 2 },
      leftHip,
    ),
    rightTorso: curve(
      rightShoulder,
      rightShoulder && rightHip && { x: rightHip.x + 0.015, y: (rightShoulder.y + rightHip.y) / 2 },
      rightHip,
    ),
    hips: curve(leftHip, hipCenter, rightHip),
    wrists: [leftWrist, rightWrist].filter((point): point is BodyPoint => point !== null),
  };
}

export function smoothDisplayLandmarks(
  previous: BodyLandmark[] | null,
  current: BodyLandmark[],
  alpha = BODY_RENDER_SMOOTHING_ALPHA,
): BodyLandmark[] {
  const boundedAlpha = Math.min(Math.max(alpha, 0), 1);
  return current.map((landmark, index) => {
    const previousLandmark = previous?.[index];
    const currentVisible = (landmark.visibility ?? 1) >= BODY_RENDER_VISIBILITY_THRESHOLD;
    const previousVisible = (previousLandmark?.visibility ?? 0) >= BODY_RENDER_VISIBILITY_THRESHOLD;
    if (!currentVisible || !previousLandmark || !previousVisible) return { ...landmark };
    return {
      ...landmark,
      x: previousLandmark.x * boundedAlpha + landmark.x * (1 - boundedAlpha),
      y: previousLandmark.y * boundedAlpha + landmark.y * (1 - boundedAlpha),
    };
  });
}

function drawCurve(
  context: CanvasRenderingContext2D,
  bodyCurve: BodyCurve,
  width: number,
  height: number,
) {
  context.moveTo(bodyCurve.start.x * width, bodyCurve.start.y * height);
  context.quadraticCurveTo(
    bodyCurve.control.x * width,
    bodyCurve.control.y * height,
    bodyCurve.end.x * width,
    bodyCurve.end.y * height,
  );
}

export function drawCurvedBody(
  context: CanvasRenderingContext2D,
  landmarks: BodyLandmark[] | null,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;
  const geometry = getCurvedBodyGeometry(landmarks);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(1.5, width / 320);
  context.strokeStyle = "#c9a96a";
  context.fillStyle = "#c9a96a";

  const curves = [
    geometry.shoulders,
    geometry.leftTorso,
    geometry.rightTorso,
    geometry.hips,
  ].filter((bodyCurve): bodyCurve is BodyCurve => bodyCurve !== null);
  curves.forEach((bodyCurve) => {
    context.beginPath();
    drawCurve(context, bodyCurve, width, height);
    context.stroke();
  });

  context.strokeStyle = "#385741";
  context.lineWidth = Math.max(2, width / 180);
  [geometry.leftArm, geometry.rightArm].forEach((bodyCurve) => {
    if (!bodyCurve) return;
    context.beginPath();
    drawCurve(context, bodyCurve, width, height);
    context.stroke();
  });

  if (geometry.head) {
    context.beginPath();
    context.ellipse(
      geometry.head.center.x * width,
      geometry.head.center.y * height,
      geometry.head.radiusX * width,
      geometry.head.radiusY * height,
      0,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = "#c9a96a";
    context.lineWidth = Math.max(1.2, width / 380);
    context.stroke();
  }

  geometry.wrists.forEach((wrist) => {
    context.beginPath();
    context.arc(wrist.x * width, wrist.y * height, Math.max(3, width / 110), 0, Math.PI * 2);
    context.fillStyle = "#385741";
    context.fill();
  });
}

export type BodyPoseRenderer = {
  draw: (landmarks: BodyLandmark[] | null) => void;
  reset: (clearCanvas?: boolean) => void;
};

export function createBodyPoseRenderer(
  canvas: HTMLCanvasElement,
  alpha = BODY_RENDER_SMOOTHING_ALPHA,
): BodyPoseRenderer {
  let previous: BodyLandmark[] | null = null;
  return {
    draw(landmarks) {
      const context = canvas.getContext("2d");
      if (!context) return;
      if (!landmarks) {
        previous = null;
        drawCurvedBody(context, null, canvas.width, canvas.height);
        return;
      }
      const displayed = smoothDisplayLandmarks(previous, landmarks, alpha);
      previous = displayed;
      drawCurvedBody(context, displayed, canvas.width, canvas.height);
    },
    reset(clearCanvas = true) {
      previous = null;
      if (clearCanvas) {
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}
