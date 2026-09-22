export const BODY_CAMERA_PRESENTATION_MIRRORED = false;

export function getBodyCameraPresentationTransform(mirrored = BODY_CAMERA_PRESENTATION_MIRRORED) {
  return mirrored ? "scaleX(-1)" : "none";
}
