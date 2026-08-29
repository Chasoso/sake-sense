export type GesturePoint = {
  x: number;
  y: number;
  t: number;
};

export type GestureFeatures = {
  pointCount: number;
  durationMs: number;
  pathLength: number;
  averageSpeed: number;
  spread: number;
  abruptEnding: boolean;
};

export type SensoryDimension = {
  dimensionId: "shape" | "duration";
  polarity: "sharp" | "round" | "short" | "lingering";
  reason: string;
};

export type GestureRepresentation = {
  dimensions: SensoryDimension[];
  tags: string[];
};

function distance(from: GesturePoint, to: GesturePoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function extractGestureFeatures(points: GesturePoint[]): GestureFeatures {
  if (points.length < 2) {
    return {
      pointCount: points.length,
      durationMs: 0,
      pathLength: 0,
      averageSpeed: 0,
      spread: 0,
      abruptEnding: false,
    };
  }

  const durationMs = Math.max(points.at(-1)!.t - points[0].t, 0);
  const pathLength = points
    .slice(1)
    .reduce((total, point, index) => total + distance(points[index], point), 0);
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const spread = Math.hypot(
    Math.max(...xValues) - Math.min(...xValues),
    Math.max(...yValues) - Math.min(...yValues),
  );
  const lastSegmentDuration = Math.max(points.at(-1)!.t - points.at(-2)!.t, 0);

  return {
    pointCount: points.length,
    durationMs,
    pathLength,
    averageSpeed: durationMs > 0 ? pathLength / durationMs : 0,
    spread,
    abruptEnding: durationMs > 0 && lastSegmentDuration / durationMs < 0.2,
  };
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
        reason: isSharp ? "the stroke ended abruptly" : "the stroke ended gradually",
      },
    ],
    tags: [isShort ? "short-lasting" : "lingering", isSharp ? "sharp-ending" : "soft-ending"],
  };
}
