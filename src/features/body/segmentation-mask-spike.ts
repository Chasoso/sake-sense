export const SEGMENTATION_THRESHOLD = 0.5;

export function readSegmentationSpikeClock(): number {
  return performance.now();
}

export type BinaryMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type MaskPoint = { x: number; y: number };

export function thresholdSegmentationMask(
  values: ArrayLike<number>,
  width: number,
  height: number,
  threshold = SEGMENTATION_THRESHOLD,
): BinaryMask {
  const data = new Uint8Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (values[index] ?? 0) >= threshold ? 1 : 0;
  }
  return { width, height, data };
}

function isForeground(mask: BinaryMask, x: number, y: number): boolean {
  return (
    x >= 0 && x < mask.width && y >= 0 && y < mask.height && mask.data[y * mask.width + x] === 1
  );
}

export function findBoundaryPixels(mask: BinaryMask): MaskPoint[] {
  const boundary: MaskPoint[] = [];
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!isForeground(mask, x, y)) continue;
      const exposed =
        !isForeground(mask, x - 1, y) ||
        !isForeground(mask, x + 1, y) ||
        !isForeground(mask, x, y - 1) ||
        !isForeground(mask, x, y + 1);
      if (exposed) boundary.push({ x, y });
    }
  }
  return boundary;
}

export function orderBoundaryPixels(
  mask: BinaryMask,
  boundary = findBoundaryPixels(mask),
): MaskPoint[] {
  if (boundary.length < 3) return boundary.slice();
  const center = boundary.reduce(
    (sum, point) => ({
      x: sum.x + point.x / boundary.length,
      y: sum.y + point.y / boundary.length,
    }),
    { x: 0, y: 0 },
  );
  return boundary
    .slice()
    .sort(
      (left, right) =>
        Math.atan2(left.y - center.y, left.x - center.x) -
        Math.atan2(right.y - center.y, right.x - center.x),
    );
}

export function drawRawMask(
  context: CanvasRenderingContext2D,
  values: ArrayLike<number>,
  width: number,
  height: number,
): void {
  const image = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = Math.max(0, Math.min(1, values[index] ?? 0)) * 255;
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value;
    image.data[index * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export function drawThresholdedMask(context: CanvasRenderingContext2D, mask: BinaryMask): void {
  const image = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    const value = mask.data[index] ? 255 : 0;
    image.data[index * 4] = value;
    image.data[index * 4 + 1] = value;
    image.data[index * 4 + 2] = value;
    image.data[index * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export function drawGoldContour(
  context: CanvasRenderingContext2D,
  mask: BinaryMask,
  width: number,
  height: number,
): number {
  const boundary = orderBoundaryPixels(mask);
  context.clearRect(0, 0, width, height);
  if (boundary.length < 3) return 0;
  const scaleX = width / mask.width;
  const scaleY = height / mask.height;
  context.beginPath();
  boundary.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.strokeStyle = "#ead7a0";
  context.lineWidth = Math.max(2, width / 180);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "rgba(234, 215, 160, 0.28)";
  context.shadowBlur = Math.max(2, width / 140);
  context.stroke();
  context.shadowBlur = 0;
  return boundary.length;
}

export type SegmentationSpikeMetrics = {
  frameCount: number;
  elapsedMs: number;
  approximateFps: number;
  poseMaskMs: number;
  thresholdMs: number;
  contourMs: number;
};
