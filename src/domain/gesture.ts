export type GesturePoint = {
  x: number;
  y: number;
  t: number;
};

export type GestureStroke = GesturePoint[];
export type GestureInput = GestureStroke[];

export function createGesturePath(points: GesturePoint[], width = 320, height = 160): string {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point, index) => {
      const x = Math.min(Math.max(point.x, 0), width);
      const y = Math.min(Math.max(point.y, 0), height);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export type GestureFeatures = {
  pointCount: number;
  durationMs: number;
  pathLength: number;
  averageSpeed: number;
  spread: number;
  horizontalDirectionChanges: number;
  endingSpeedRatio: number;
  abruptEnding: boolean;
};

export type SensoryDimension = {
  dimensionId: "weight" | "shape" | "duration";
  polarity: "light" | "heavy" | "sharp" | "round" | "short" | "lingering";
  reason: string;
};

export type GestureRepresentation = {
  dimensions: SensoryDimension[];
  tags: string[];
};

function distance(from: GesturePoint, to: GesturePoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function extractGestureFeatures(input: GesturePoint[] | GestureInput): GestureFeatures {
  const strokes: GestureInput = Array.isArray(input[0])
    ? (input as GestureInput).filter((stroke) => stroke.length > 0)
    : [input as GesturePoint[]];
  const points = strokes.flat();
  if (points.length < 2) {
    return {
      pointCount: points.length,
      durationMs: 0,
      pathLength: 0,
      averageSpeed: 0,
      spread: 0,
      horizontalDirectionChanges: 0,
      endingSpeedRatio: 0,
      abruptEnding: false,
    };
  }

  const durationMs = strokes.reduce(
    (total, stroke) => total + Math.max(stroke.at(-1)!.t - stroke[0].t, 0),
    0,
  );
  const pathLength = strokes.reduce(
    (total, stroke) =>
      total +
      stroke
        .slice(1)
        .reduce((strokeTotal, point, index) => strokeTotal + distance(stroke[index], point), 0),
    0,
  );
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const spread = Math.hypot(
    Math.max(...xValues) - Math.min(...xValues),
    Math.max(...yValues) - Math.min(...yValues),
  );
  const segments = strokes.flatMap((stroke, strokeIndex) =>
    stroke.slice(1).flatMap((point, index) => {
      const duration = point.t - stroke[index].t;
      return duration > 0
        ? [
            {
              strokeIndex,
              midpoint: (stroke[index].t + point.t) / 2,
              speed: distance(stroke[index], point) / duration,
            },
          ]
        : [];
    }),
  );
  const finalStroke = strokes.at(-1)!;
  const finalStrokeStart = finalStroke[0].t;
  const finalStrokeDuration = Math.max(finalStroke.at(-1)!.t - finalStrokeStart, 0);
  const endingBoundary = finalStrokeStart + finalStrokeDuration * 0.75;
  const endingSegments = segments.filter(
    (segment) => segment.strokeIndex === strokes.length - 1 && segment.midpoint >= endingBoundary,
  );
  const earlierSegments = segments.filter((segment) => !endingSegments.includes(segment));
  const terminalSpeeds = (endingSegments.length > 0 ? endingSegments : segments.slice(-1)).map(
    (segment) => segment.speed,
  );
  const earlierSpeeds = (earlierSegments.length > 0 ? earlierSegments : segments).map(
    (segment) => segment.speed,
  );
  const representativeSpeed = median(earlierSpeeds);
  const endingSpeed = average(terminalSpeeds);
  const endingSpeedRatio = representativeSpeed > 0 ? endingSpeed / representativeSpeed : 0;
  const horizontalDirectionChanges = strokes.reduce(
    (total, stroke) =>
      total +
      stroke.slice(2).reduce((changes, point, index) => {
        const previous = stroke[index];
        const current = stroke[index + 1];
        const previousDirection = Math.sign(current.x - previous.x);
        const currentDirection = Math.sign(point.x - current.x);
        return previousDirection !== 0 &&
          currentDirection !== 0 &&
          previousDirection !== currentDirection
          ? changes + 1
          : changes;
      }, 0),
    0,
  );

  return {
    pointCount: points.length,
    durationMs,
    pathLength,
    averageSpeed: durationMs > 0 ? pathLength / durationMs : 0,
    spread,
    horizontalDirectionChanges,
    endingSpeedRatio,
    abruptEnding: representativeSpeed > 0 && endingSpeedRatio >= 0.75,
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function gestureToRepresentation(features: GestureFeatures): GestureRepresentation {
  const isShort = features.durationMs <= 700;
  const isSharp = features.abruptEnding;

  return {
    dimensions: [
      {
        dimensionId: "duration",
        polarity: isShort ? "short" : "lingering",
        reason: `stroke duration ${Math.round(features.durationMs)}ms`,
      },
      {
        dimensionId: "shape",
        polarity: isSharp ? "sharp" : "round",
        reason: isSharp
          ? `ending speed stayed near the earlier stroke speed (ratio ${features.endingSpeedRatio.toFixed(2)})`
          : `ending speed slowed relative to the earlier stroke (ratio ${features.endingSpeedRatio.toFixed(2)})`,
      },
    ],
    tags: [isShort ? "short-lasting" : "lingering", isSharp ? "sharp-ending" : "soft-ending"],
  };
}
