import type { BodyLandmark } from "../../domain/body";
import {
  BODY_RENDER_VISIBILITY_THRESHOLD,
  contourPathToCanvas,
  getBodyContourGeometry,
} from "./body-contour-geometry";
import type { BodyContourGeometry } from "./body-contour-geometry";

export { BODY_RENDER_VISIBILITY_THRESHOLD } from "./body-contour-geometry";
export type { BodyPoint } from "./body-contour-geometry";

export const BODY_RENDER_SMOOTHING_ALPHA = 0.25;

export function getBodyContourForLandmarks(landmarks: BodyLandmark[]): BodyContourGeometry {
  return getBodyContourGeometry(landmarks);
}

function drawContour(
  context: CanvasRenderingContext2D,
  path: NonNullable<BodyContourGeometry[keyof BodyContourGeometry]>,
  width: number,
  height: number,
): void {
  context.beginPath();
  contourPathToCanvas(context, path, width, height);
  context.stroke();
}

export function drawCurvedBody(
  context: CanvasRenderingContext2D,
  landmarks: BodyLandmark[] | null,
  width: number,
  height: number,
): void {
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;
  const geometry = getBodyContourGeometry(landmarks);
  const paths = Object.values(geometry).filter(
    (path): path is NonNullable<BodyContourGeometry[keyof BodyContourGeometry]> => path !== null,
  );

  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2.5, width / 125);
  context.strokeStyle = "#ead7a0";
  context.shadowColor = "rgba(234, 215, 160, 0.28)";
  context.shadowBlur = Math.max(3, width / 100);
  paths.forEach((path) => drawContour(context, path, width, height));
  context.shadowBlur = 0;
  paths.forEach((path) => drawContour(context, path, width, height));
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
