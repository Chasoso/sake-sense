export type CameraFacingMode = "user" | "environment";

export const BODY_CAMERA_DEFAULT_FACING_MODE: CameraFacingMode = "user";
export const BODY_CAMERA_PRESENTATION_MIRRORED = true;

export function shouldMirrorBodyCameraPresentation(
  actualFacingMode: string | undefined,
  requestedFacingMode: CameraFacingMode = BODY_CAMERA_DEFAULT_FACING_MODE,
): boolean {
  if (actualFacingMode === "environment") return false;
  if (actualFacingMode === "user") return true;
  return requestedFacingMode === "user";
}

export function getBodyCameraPresentationTransform(mirrored = BODY_CAMERA_PRESENTATION_MIRRORED) {
  return mirrored ? "scaleX(-1)" : "none";
}
