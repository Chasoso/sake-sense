export const SEGMENTATION_THRESHOLD = 0.5;
export const RAW_MASK_ISO_LEVEL = 0.5;
export const CONTOUR_SIMPLIFY_TOLERANCE = 0.8;
export const CONTOUR_SMOOTHING_PASSES = 1;
export const CONTOUR_RESAMPLE_POINT_COUNT = 96;
export const CONTOUR_SPATIAL_AVERAGING_RADIUS = 0;
export const CONTOUR_TEMPORAL_ALPHA = 0.75;
export const CONTOUR_REACQUIRE_RESET_FRAME_COUNT = 3;
export const CONTOUR_DISCONTINUITY_DISTANCE = 48;
export const INNER_CONTOUR_MIN_AREA = 24;
export const INNER_CONTOUR_OPACITY = 0.7;
export const INNER_CONTOUR_LINE_WIDTH_SCALE = 0.7;

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

export type HoleComponent = {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: MaskPoint[];
};

export type PaddedMask = {
  width: number;
  height: number;
  values: Float32Array;
};

/** Adds an explicit zero-valued background cell around the source mask. */
export function createPaddedMask(
  values: ArrayLike<number>,
  width: number,
  height: number,
): PaddedMask {
  const paddedWidth = width + 2;
  const paddedHeight = height + 2;
  const paddedValues = new Float32Array(paddedWidth * paddedHeight);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      paddedValues[(y + 1) * paddedWidth + x + 1] = values[y * width + x] ?? 0;
    }
  }
  return { width: paddedWidth, height: paddedHeight, values: paddedValues };
}

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

function isMaskBorder(x: number, y: number, width: number, height: number): boolean {
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

function maskIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

/** Finds background components that are not connected to the mask border. */
export function findEnclosedBackgroundComponents(mask: BinaryMask): HoleComponent[] {
  const visited = new Uint8Array(mask.data.length);
  const holes: HoleComponent[] = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const startIndex = maskIndex(x, y, mask.width);
      if (mask.data[startIndex] || visited[startIndex]) continue;
      const queue: MaskPoint[] = [{ x, y }];
      visited[startIndex] = 1;
      const pixels: MaskPoint[] = [];
      let touchesBorder = false;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const point = queue[queueIndex];
        pixels.push(point);
        touchesBorder ||= isMaskBorder(point.x, point.y, mask.width, mask.height);
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
        directions.forEach(([dx, dy]) => {
          const nextX = point.x + dx;
          const nextY = point.y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= mask.width || nextY >= mask.height) {
            return;
          }
          const nextIndex = maskIndex(nextX, nextY, mask.width);
          if (!mask.data[nextIndex] && !visited[nextIndex]) {
            visited[nextIndex] = 1;
            queue.push({ x: nextX, y: nextY });
          }
        });
      }
      if (!touchesBorder) holes.push({ area: pixels.length, minX, minY, maxX, maxY, pixels });
    }
  }
  return holes;
}

export function filterHoleComponents(
  holes: HoleComponent[],
  minArea = INNER_CONTOUR_MIN_AREA,
): HoleComponent[] {
  return holes
    .filter((hole) => hole.area >= minArea)
    .map((hole) => ({ ...hole, pixels: hole.pixels.slice() }));
}

export function extractInnerContours(mask: BinaryMask, holes: HoleComponent[]): Contour[] {
  return holes.flatMap((hole) => {
    const holeMask = new Uint8Array(mask.data.length);
    hole.pixels.forEach((point) => {
      holeMask[maskIndex(point.x, point.y, mask.width)] = 1;
    });
    const contours = extractIsoContours(holeMask, mask.width, mask.height);
    const primary = selectPrimaryContour(contours);
    return primary ? [primary] : [];
  });
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
  const padded = createPaddedMask(values, width, height);
  const segments: Segment[] = [];
  const at = (x: number, y: number) => padded.values[y * padded.width + x] ?? 0;
  for (let y = 0; y < padded.height - 1; y += 1) {
    for (let x = 0; x < padded.width - 1; x += 1) {
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
  return connectSegments(segments).map((contour) =>
    contour.map((point) => ({ x: point.x - 1, y: point.y - 1 })),
  );
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

/** Applies a light circular moving average while preserving contour cardinality. */
export function averageClosedContour(
  contour: Contour,
  radius = CONTOUR_SPATIAL_AVERAGING_RADIUS,
): Contour {
  if (contour.length < 3 || radius < 1) return contour.map((point) => ({ ...point }));
  const result: Contour = [];
  for (let index = 0; index < contour.length; index += 1) {
    let weightSum = 0;
    let x = 0;
    let y = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const point = contour[(index + offset + contour.length) % contour.length];
      const distance = Math.abs(offset);
      const weight = distance === 0 ? 2 : 1;
      x += point.x * weight;
      y += point.y * weight;
      weightSum += weight;
    }
    result.push({ x: x / weightSum, y: y / weightSum });
  }
  return result;
}

function withoutDuplicateClosingPoint(contour: Contour): Contour {
  if (contour.length > 1) {
    const first = contour[0];
    const last = contour.at(-1)!;
    if (first.x === last.x && first.y === last.y) return contour.slice(0, -1);
  }
  return contour.slice();
}

export function signedPolygonArea(contour: Contour): number {
  return (
    contour.reduce((area, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

export type ContourWinding = "clockwise" | "counterclockwise";

export function ensureContourWinding(
  contour: Contour,
  winding: ContourWinding = "clockwise",
): Contour {
  const source = withoutDuplicateClosingPoint(contour);
  if (source.length < 3) return source;
  const area = signedPolygonArea(source);
  const shouldReverse = winding === "clockwise" ? area < 0 : area > 0;
  return shouldReverse ? source.slice().reverse() : source;
}

/** Resamples a closed contour at equal arc-length intervals without a duplicate endpoint. */
export function resampleClosedContour(
  contour: Contour,
  pointCount = CONTOUR_RESAMPLE_POINT_COUNT,
): Contour {
  const source = withoutDuplicateClosingPoint(contour);
  if (source.length < 3 || pointCount < 3) return [];
  const lengths = source.map((point, index) => {
    const next = source[(index + 1) % source.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  if (perimeter === 0) return [];
  const result: Contour = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;
  for (let index = 0; index < pointCount; index += 1) {
    const targetDistance = (index / pointCount) * perimeter;
    while (
      segmentIndex < lengths.length - 1 &&
      targetDistance > segmentStartDistance + lengths[segmentIndex]
    ) {
      segmentStartDistance += lengths[segmentIndex];
      segmentIndex += 1;
    }
    const start = source[segmentIndex];
    const end = source[(segmentIndex + 1) % source.length];
    const segmentLength = lengths[segmentIndex];
    const ratio = segmentLength === 0 ? 0 : (targetDistance - segmentStartDistance) / segmentLength;
    result.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }
  return result;
}

export function prepareContourForStabilization(
  contour: Contour,
  pointCount = CONTOUR_RESAMPLE_POINT_COUNT,
): Contour {
  return ensureContourWinding(resampleClosedContour(contour, pointCount), "clockwise");
}

export type ContourAlignment = {
  contour: Contour;
  offset: number;
  averageDistance: number;
};

export function alignContourToReferenceWithMetrics(
  current: Contour,
  reference: Contour,
): ContourAlignment {
  if (current.length !== reference.length || current.length < 3) {
    return { contour: current.slice(), offset: 0, averageDistance: Number.POSITIVE_INFINITY };
  }
  let bestOffset = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < current.length; offset += 1) {
    let squaredDistance = 0;
    for (let index = 0; index < current.length; index += 1) {
      const point = current[(index + offset) % current.length];
      const referencePoint = reference[index];
      const dx = point.x - referencePoint.x;
      const dy = point.y - referencePoint.y;
      squaredDistance += dx * dx + dy * dy;
    }
    if (squaredDistance < bestDistance) {
      bestDistance = squaredDistance;
      bestOffset = offset;
    }
  }
  const aligned = current.map((_, index) => current[(index + bestOffset) % current.length]);
  return {
    contour: aligned,
    offset: bestOffset,
    averageDistance: Math.sqrt(bestDistance / current.length),
  };
}

export function alignContourToReference(current: Contour, reference: Contour): Contour {
  return alignContourToReferenceWithMetrics(current, reference).contour;
}

function blendContours(previous: Contour, current: Contour, previousWeight: number): Contour {
  const weight = Math.min(Math.max(previousWeight, 0), 1);
  return current.map((point, index) => ({
    x: previous[index].x * weight + point.x * (1 - weight),
    y: previous[index].y * weight + point.y * (1 - weight),
  }));
}

export type StabilizedContourResult = {
  contour: Contour | null;
  alignmentOffset: number;
  averageCorrectionDistance: number;
  alignmentMs: number;
  temporalSmoothingMs: number;
  held: boolean;
  snapped: boolean;
  reset: boolean;
};

/** Display-only contour state. It never mutates the source contour or pose data. */
export class ContourStabilizer {
  private displayedContour: Contour | null = null;
  private missingFrameCount = 0;
  private readonly pointCount: number;
  private readonly temporalAlpha: number;
  private readonly reacquireResetFrameCount: number;
  private readonly discontinuityDistance: number;

  constructor({
    pointCount = CONTOUR_RESAMPLE_POINT_COUNT,
    temporalAlpha = CONTOUR_TEMPORAL_ALPHA,
    reacquireResetFrameCount = CONTOUR_REACQUIRE_RESET_FRAME_COUNT,
    discontinuityDistance = CONTOUR_DISCONTINUITY_DISTANCE,
  }: {
    pointCount?: number;
    temporalAlpha?: number;
    reacquireResetFrameCount?: number;
    discontinuityDistance?: number;
  } = {}) {
    this.pointCount = pointCount;
    this.temporalAlpha = temporalAlpha;
    this.reacquireResetFrameCount = reacquireResetFrameCount;
    this.discontinuityDistance = discontinuityDistance;
  }

  reset(): void {
    this.displayedContour = null;
    this.missingFrameCount = 0;
  }

  update(preparedContour: Contour | null): StabilizedContourResult {
    if (!preparedContour || preparedContour.length !== this.pointCount) {
      this.missingFrameCount += 1;
      if (this.missingFrameCount > this.reacquireResetFrameCount) {
        this.reset();
        return {
          contour: null,
          alignmentOffset: 0,
          averageCorrectionDistance: 0,
          alignmentMs: 0,
          temporalSmoothingMs: 0,
          held: false,
          snapped: false,
          reset: true,
        };
      }
      return {
        contour: this.displayedContour?.map((point) => ({ ...point })) ?? null,
        alignmentOffset: 0,
        averageCorrectionDistance: 0,
        alignmentMs: 0,
        temporalSmoothingMs: 0,
        held: this.displayedContour !== null,
        snapped: false,
        reset: false,
      };
    }
    this.missingFrameCount = 0;
    const current = preparedContour.map((point) => ({ ...point }));
    if (!this.displayedContour) {
      this.displayedContour = current;
      return {
        contour: current.map((point) => ({ ...point })),
        alignmentOffset: 0,
        averageCorrectionDistance: 0,
        alignmentMs: 0,
        temporalSmoothingMs: 0,
        held: false,
        snapped: false,
        reset: false,
      };
    }
    const alignmentStartedAt = readSegmentationSpikeClock();
    const aligned = alignContourToReferenceWithMetrics(current, this.displayedContour);
    const alignmentMs = readSegmentationSpikeClock() - alignmentStartedAt;
    if (aligned.averageDistance > this.discontinuityDistance) {
      this.displayedContour = current;
      return {
        contour: current.map((point) => ({ ...point })),
        alignmentOffset: aligned.offset,
        averageCorrectionDistance: aligned.averageDistance,
        alignmentMs,
        temporalSmoothingMs: 0,
        held: false,
        snapped: true,
        reset: false,
      };
    }
    const temporalStartedAt = readSegmentationSpikeClock();
    this.displayedContour = blendContours(
      this.displayedContour,
      aligned.contour,
      this.temporalAlpha,
    );
    const temporalSmoothingMs = readSegmentationSpikeClock() - temporalStartedAt;
    return {
      contour: this.displayedContour.map((point) => ({ ...point })),
      alignmentOffset: aligned.offset,
      averageCorrectionDistance: aligned.averageDistance,
      alignmentMs,
      temporalSmoothingMs,
      held: false,
      snapped: false,
      reset: false,
    };
  }
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

function drawContourPath(
  context: CanvasRenderingContext2D,
  contour: Contour,
  width: number,
  height: number,
  color: string,
  sourceWidth = width,
  sourceHeight = height,
  lineWidthScale = 1,
): number {
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
  context.lineWidth = Math.max(1, (width / 180) * lineWidthScale);
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "rgba(234, 215, 160, 0.28)";
  context.shadowBlur = Math.max(2, width / 140);
  context.stroke();
  context.shadowBlur = 0;
  return contour.length;
}

export function drawContours(
  context: CanvasRenderingContext2D,
  contours: Contour[],
  width: number,
  height: number,
  color = "#ead7a0",
  sourceWidth = width,
  sourceHeight = height,
  lineWidthScale = 1,
  clear = true,
): number {
  if (clear) context.clearRect(0, 0, width, height);
  return contours.reduce(
    (count, contour) =>
      contour.length >= 3
        ? count +
          drawContourPath(
            context,
            contour,
            width,
            height,
            color,
            sourceWidth,
            sourceHeight,
            lineWidthScale,
          )
        : count,
    0,
  );
}

export function drawContour(
  context: CanvasRenderingContext2D,
  contour: Contour | null,
  width: number,
  height: number,
  color = "#ead7a0",
  sourceWidth = width,
  sourceHeight = height,
  lineWidthScale = 1,
): number {
  return drawContours(
    context,
    contour ? [contour] : [],
    width,
    height,
    color,
    sourceWidth,
    sourceHeight,
    lineWidthScale,
  );
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
  spatialAveragingMs: number;
  holeDetectionMs: number;
  holeFilteringMs: number;
  innerContourMs: number;
  innerContourCount: number;
  acceptedHoleArea: number;
  resamplingMs: number;
  windingMs: number;
  alignmentMs: number;
  temporalSmoothingMs: number;
  rawContourPointCount: number;
  stabilizedContourPointCount: number;
  alignmentOffset: number;
  averageTemporalCorrectionDistance: number;
  resetCount: number;
  finalContourPointCount: number;
};
