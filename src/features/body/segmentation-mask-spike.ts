export const SEGMENTATION_THRESHOLD = 0.5;
export const RAW_MASK_ISO_LEVEL = 0.5;
export const CONTOUR_SIMPLIFY_TOLERANCE = 0.8;
export const CONTOUR_SMOOTHING_PASSES = 1;

export function readSegmentationSpikeClock(): number {
  return performance.now();
}

export type BinaryMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type MaskPoint = { x: number; y: number };
export type Contour = MaskPoint[];

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

type Segment = { start: MaskPoint; end: MaskPoint };

function interpolate(a: number, b: number, level: number): number {
  if (a === b) return 0.5;
  return Math.min(Math.max((level - a) / (b - a), 0), 1);
}

function edgePoint(
  edge: number,
  x: number,
  y: number,
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  level: number,
): MaskPoint {
  if (edge === 0) {
    return { x: x + interpolate(topLeft, topRight, level), y };
  }
  if (edge === 1) {
    return { x: x + 1, y: y + interpolate(topRight, bottomRight, level) };
  }
  if (edge === 2) {
    return { x: x + interpolate(bottomLeft, bottomRight, level), y: y + 1 };
  }
  return { x, y: y + interpolate(topLeft, bottomLeft, level) };
}

function cellSegments(caseIndex: number): Array<[number, number]> {
  switch (caseIndex) {
    case 1:
      return [[3, 0]];
    case 2:
      return [[0, 1]];
    case 3:
      return [[3, 1]];
    case 4:
      return [[1, 2]];
    case 5:
      return [
        [3, 2],
        [0, 1],
      ];
    case 6:
      return [[0, 2]];
    case 7:
      return [[3, 2]];
    case 8:
      return [[2, 3]];
    case 9:
      return [[0, 2]];
    case 10:
      return [
        [0, 1],
        [2, 3],
      ];
    case 11:
      return [[1, 2]];
    case 12:
      return [[1, 3]];
    case 13:
      return [[0, 1]];
    case 14:
      return [[3, 0]];
    default:
      return [];
  }
}

function pointKey(point: MaskPoint): string {
  return `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
}

function connectSegments(segments: Segment[]): Contour[] {
  const byPoint = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    [segment.start, segment.end].forEach((point) => {
      const key = pointKey(point);
      const edges = byPoint.get(key) ?? [];
      edges.push(index);
      byPoint.set(key, edges);
    });
  });
  const used = new Set<number>();
  const contours: Contour[] = [];
  segments.forEach((firstSegment, firstIndex) => {
    if (used.has(firstIndex)) return;
    used.add(firstIndex);
    const contour: Contour = [firstSegment.start, firstSegment.end];
    let current = firstSegment.end;
    const startKey = pointKey(firstSegment.start);
    while (pointKey(current) !== startKey) {
      const candidates = byPoint.get(pointKey(current)) ?? [];
      const nextIndex = candidates.find((index) => !used.has(index));
      if (nextIndex === undefined) break;
      used.add(nextIndex);
      const next = segments[nextIndex];
      current = pointKey(next.start) === pointKey(current) ? next.end : next.start;
      contour.push(current);
    }
    if (pointKey(contour.at(-1)!) === pointKey(contour[0])) contour.pop();
    if (contour.length >= 3) contours.push(contour);
  });
  return contours;
}

/** Extracts ordered iso-contours directly from a float confidence mask. */
export function extractIsoContours(
  values: ArrayLike<number>,
  width: number,
  height: number,
  isoLevel = RAW_MASK_ISO_LEVEL,
): Contour[] {
  if (width < 2 || height < 2) return [];
  const segments: Segment[] = [];
  const at = (x: number, y: number) => values[y * width + x] ?? 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const topLeft = at(x, y);
      const topRight = at(x + 1, y);
      const bottomRight = at(x + 1, y + 1);
      const bottomLeft = at(x, y + 1);
      const caseIndex =
        (topLeft >= isoLevel ? 1 : 0) |
        (topRight >= isoLevel ? 2 : 0) |
        (bottomRight >= isoLevel ? 4 : 0) |
        (bottomLeft >= isoLevel ? 8 : 0);
      cellSegments(caseIndex).forEach(([startEdge, endEdge]) => {
        segments.push({
          start: edgePoint(startEdge, x, y, topLeft, topRight, bottomRight, bottomLeft, isoLevel),
          end: edgePoint(endEdge, x, y, topLeft, topRight, bottomRight, bottomLeft, isoLevel),
        });
      });
    }
  }
  return connectSegments(segments);
}

export function polygonArea(contour: Contour): number {
  return Math.abs(
    contour.reduce((area, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

export function selectPrimaryContour(contours: Contour[]): Contour | null {
  return contours.reduce<Contour | null>(
    (largest, contour) =>
      !largest || polygonArea(contour) > polygonArea(largest) ? contour : largest,
    null,
  );
}

function perpendicularDistance(point: MaskPoint, start: MaskPoint, end: MaskPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return (
    Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy)
  );
}

function simplifyOpenContour(points: Contour, tolerance: number): Contour {
  if (points.length <= 2) return points.slice();
  let splitIndex = -1;
  let maxDistance = tolerance;
  points.slice(1, -1).forEach((point, index) => {
    const distance = perpendicularDistance(point, points[0], points.at(-1)!);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index + 1;
    }
  });
  if (splitIndex < 0) return [points[0], points.at(-1)!];
  return [
    ...simplifyOpenContour(points.slice(0, splitIndex + 1), tolerance).slice(0, -1),
    ...simplifyOpenContour(points.slice(splitIndex), tolerance),
  ];
}

export function simplifyContour(contour: Contour, tolerance = CONTOUR_SIMPLIFY_TOLERANCE): Contour {
  if (contour.length < 4) return contour.slice();
  const simplified = simplifyOpenContour([...contour, contour[0]], tolerance);
  simplified.pop();
  return simplified.length >= 3 ? simplified : contour.slice();
}

export function smoothContour(contour: Contour, passes = CONTOUR_SMOOTHING_PASSES): Contour {
  let current = contour.slice();
  for (let pass = 0; pass < Math.max(0, passes); pass += 1) {
    if (current.length < 3) break;
    const next: Contour = [];
    current.forEach((point, index) => {
      const following = current[(index + 1) % current.length];
      next.push(
        { x: point.x * 0.75 + following.x * 0.25, y: point.y * 0.75 + following.y * 0.25 },
        { x: point.x * 0.25 + following.x * 0.75, y: point.y * 0.25 + following.y * 0.75 },
      );
    });
    current = next;
  }
  return current;
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

export function drawContour(
  context: CanvasRenderingContext2D,
  contour: Contour | null,
  width: number,
  height: number,
  color = "#ead7a0",
  sourceWidth = width,
  sourceHeight = height,
): number {
  context.clearRect(0, 0, width, height);
  if (!contour || contour.length < 3) return 0;
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;
  context.beginPath();
  contour.forEach((point, index) => {
    const x = point.x * scaleX;
    const y = point.y * scaleY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.strokeStyle = color;
  context.lineWidth = Math.max(2, width / 180);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "rgba(234, 215, 160, 0.28)";
  context.shadowBlur = Math.max(2, width / 140);
  context.stroke();
  context.shadowBlur = 0;
  return contour.length;
}

export type SegmentationSpikeMetrics = {
  frameCount: number;
  elapsedMs: number;
  approximateFps: number;
  poseMaskMs: number;
  thresholdMs: number;
  preprocessingMs: number;
  contourMs: number;
  selectionMs: number;
  simplificationMs: number;
  smoothingMs: number;
  rawContourPointCount: number;
  finalContourPointCount: number;
};
