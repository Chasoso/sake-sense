export type CoverTransform = {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function getObjectFitCoverTransform(
  sourceWidth: number,
  sourceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CoverTransform {
  const safeSourceWidth = Math.max(sourceWidth, 1);
  const safeSourceHeight = Math.max(sourceHeight, 1);
  const safeViewportWidth = Math.max(viewportWidth, 1);
  const safeViewportHeight = Math.max(viewportHeight, 1);
  const scale = Math.max(
    safeViewportWidth / safeSourceWidth,
    safeViewportHeight / safeSourceHeight,
  );
  const displayWidth = safeSourceWidth * scale;
  const displayHeight = safeSourceHeight * scale;

  return {
    sourceWidth: safeSourceWidth,
    sourceHeight: safeSourceHeight,
    viewportWidth: safeViewportWidth,
    viewportHeight: safeViewportHeight,
    scale,
    offsetX: (safeViewportWidth - displayWidth) / 2,
    offsetY: (safeViewportHeight - displayHeight) / 2,
  };
}

export function projectNormalizedPointToCoverViewport(
  point: { x: number; y: number },
  transform: CoverTransform,
): { x: number; y: number } {
  return {
    x: point.x * transform.sourceWidth * transform.scale + transform.offsetX,
    y: point.y * transform.sourceHeight * transform.scale + transform.offsetY,
  };
}
