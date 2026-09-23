import type { BinaryMask, Contour, MaskPoint } from "./segmentation-mask-spike";

/** Small, display-only contour analysis constants for the architecture spike. */
export const CONCAVITY_NEIGHBORHOOD = 2;
export const CONCAVITY_TURN_THRESHOLD = 0.22;
export const CONCAVITY_DEVIATION_THRESHOLD = 1.5;
export const SEPARATOR_MIN_CONTOUR_GAP = 4;
export const SEPARATOR_MAX_CONTOUR_GAP = 18;
export const SEPARATOR_MAX_LENGTH = 42;
export const SEPARATOR_MIN_LENGTH = 6;
export const SEPARATOR_MIN_INSIDE_RATIO = 0.78;
export const SEPARATOR_SAMPLE_COUNT = 17;

export type ConcavityCandidate = {
  index: number;
  point: MaskPoint;
  strength: number;
  deviation: number;
};

export type SeparatorCandidate = {
  concavityIndex: number;
  start: MaskPoint;
  end: MaskPoint;
  length: number;
  insideRatio: number;
  concavityStrength: number;
};

function distance(a: MaskPoint, b: MaskPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function cross(a: MaskPoint, b: MaskPoint, c: MaskPoint): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function signedArea(contour: Contour): number {
  return (
    contour.reduce((area, point, index) => {
      const next = contour[(index + 1) % contour.length];
      return area + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function perpendicularDistance(point: MaskPoint, start: MaskPoint, end: MaskPoint): number {
  const length = distance(start, end);
  if (length === 0) return 0;
  return (
    Math.abs(
      (end.y - start.y) * point.x - (end.x - start.x) * point.y + end.x * start.y - end.y * start.x,
    ) / length
  );
}

/**
 * Finds inward turns using normalized signed curvature. Multiplying by the
 * polygon winding makes the result independent of clockwise/counterclockwise
 * contour ordering. The chord deviation suppresses small raster wiggles.
 */
export function findConcavityCandidates(
  contour: Contour,
  {
    neighborhood = CONCAVITY_NEIGHBORHOOD,
    turnThreshold = CONCAVITY_TURN_THRESHOLD,
    deviationThreshold = CONCAVITY_DEVIATION_THRESHOLD,
  }: {
    neighborhood?: number;
    turnThreshold?: number;
    deviationThreshold?: number;
  } = {},
): ConcavityCandidate[] {
  if (contour.length < neighborhood * 2 + 1) return [];
  const winding = Math.sign(signedArea(contour)) || 1;
  const candidates: ConcavityCandidate[] = [];
  for (let index = 0; index < contour.length; index += 1) {
    const previous = contour[(index - neighborhood + contour.length) % contour.length];
    const point = contour[index];
    const next = contour[(index + neighborhood) % contour.length];
    const previousLength = distance(previous, point);
    const nextLength = distance(point, next);
    const denominator = previousLength * nextLength;
    if (denominator === 0) continue;
    const normalizedTurn = (cross(previous, point, next) * winding) / denominator;
    const deviation = perpendicularDistance(point, previous, next);
    if (normalizedTurn <= -turnThreshold && deviation >= deviationThreshold) {
      candidates.push({
        index,
        point: { ...point },
        strength: Math.abs(normalizedTurn),
        deviation,
      });
    }
  }
  return candidates;
}

function maskContains(mask: BinaryMask, point: MaskPoint): boolean {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  return (
    x >= 0 && y >= 0 && x < mask.width && y < mask.height && mask.data[y * mask.width + x] === 1
  );
}

function segmentInsideRatio(mask: BinaryMask, start: MaskPoint, end: MaskPoint): number {
  let inside = 0;
  for (let sample = 1; sample < SEPARATOR_SAMPLE_COUNT; sample += 1) {
    const ratio = sample / SEPARATOR_SAMPLE_COUNT;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    if (maskContains(mask, point)) inside += 1;
  }
  return inside / (SEPARATOR_SAMPLE_COUNT - 1);
}

/**
 * Pairs a concavity with a nearby contour point and keeps only short chords
 * whose interior samples remain in the primary-person mask. No pose data is
 * consulted, so unavailable pose never hides the diagnostic geometry.
 */
export function generateSeparatorCandidates(
  contour: Contour,
  mask: BinaryMask,
  concavities = findConcavityCandidates(contour),
  {
    minContourGap = SEPARATOR_MIN_CONTOUR_GAP,
    maxContourGap = SEPARATOR_MAX_CONTOUR_GAP,
    minLength = SEPARATOR_MIN_LENGTH,
    maxLength = SEPARATOR_MAX_LENGTH,
    minInsideRatio = SEPARATOR_MIN_INSIDE_RATIO,
  }: {
    minContourGap?: number;
    maxContourGap?: number;
    minLength?: number;
    maxLength?: number;
    minInsideRatio?: number;
  } = {},
): SeparatorCandidate[] {
  const result: SeparatorCandidate[] = [];
  concavities.forEach((concavity) => {
    let best: SeparatorCandidate | null = null;
    for (let offset = minContourGap; offset <= maxContourGap; offset += 1) {
      for (const direction of [-1, 1]) {
        const endIndex =
          (concavity.index + direction * offset + contour.length * 2) % contour.length;
        const end = contour[endIndex];
        const length = distance(concavity.point, end);
        if (length < minLength || length > maxLength) continue;
        const insideRatio = segmentInsideRatio(mask, concavity.point, end);
        if (insideRatio < minInsideRatio) continue;
        const candidate: SeparatorCandidate = {
          concavityIndex: concavity.index,
          start: { ...concavity.point },
          end: { ...end },
          length,
          insideRatio,
          concavityStrength: concavity.strength,
        };
        if (!best || candidate.length < best.length) best = candidate;
      }
    }
    if (best) result.push(best);
  });
  return result;
}

export function drawConcavityCandidates(
  context: CanvasRenderingContext2D,
  candidates: ConcavityCandidate[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
): void {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f1cb84";
  candidates.forEach(({ point }) => {
    context.beginPath();
    context.arc(
      (point.x / sourceWidth) * width,
      (point.y / sourceHeight) * height,
      4,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
}

export function drawSeparatorCandidates(
  context: CanvasRenderingContext2D,
  candidates: SeparatorCandidate[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  color = "#ead7a0",
  clear = true,
): void {
  if (clear) context.clearRect(0, 0, width, height);
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, width / 180);
  context.lineCap = "round";
  candidates.forEach(({ start, end }) => {
    context.beginPath();
    context.moveTo((start.x / sourceWidth) * width, (start.y / sourceHeight) * height);
    context.lineTo((end.x / sourceWidth) * width, (end.y / sourceHeight) * height);
    context.stroke();
  });
}
