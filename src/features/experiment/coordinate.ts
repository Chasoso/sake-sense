export type ScreenMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type ViewBoxPoint = { x: number; y: number };

export function clientToViewBoxPoint(
  clientX: number,
  clientY: number,
  matrix: ScreenMatrix | null,
  fallback: ViewBoxPoint,
  width = 320,
  height = 160,
): ViewBoxPoint {
  const determinant = matrix ? matrix.a * matrix.d - matrix.b * matrix.c : 0;
  if (
    !matrix ||
    !Number.isFinite(determinant) ||
    determinant === 0 ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    return clampPoint(fallback, width, height);
  }

  const translatedX = clientX - matrix.e;
  const translatedY = clientY - matrix.f;
  return clampPoint(
    {
      x: (matrix.d * translatedX - matrix.c * translatedY) / determinant,
      y: (-matrix.b * translatedX + matrix.a * translatedY) / determinant,
    },
    width,
    height,
  );
}

function clampPoint(point: ViewBoxPoint, width: number, height: number): ViewBoxPoint {
  return {
    x: Math.min(Math.max(Number.isFinite(point.x) ? point.x : 0, 0), width),
    y: Math.min(Math.max(Number.isFinite(point.y) ? point.y : 0, 0), height),
  };
}
