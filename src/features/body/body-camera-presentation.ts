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

export function isConfirmedCameraSwitchAvailable(
  videoInputCount: number,
  actualFacingMode: string | undefined,
): boolean {
  return videoInputCount > 1 && (actualFacingMode === "user" || actualFacingMode === "environment");
}

export function isSameEffectiveCamera(
  previousDeviceId: string | undefined,
  nextDeviceId: string | undefined,
  previousFacingMode: CameraFacingMode,
  nextFacingMode: string | undefined,
): boolean {
  return (
    (Boolean(previousDeviceId) && Boolean(nextDeviceId) && previousDeviceId === nextDeviceId) ||
    (Boolean(nextFacingMode) && previousFacingMode === nextFacingMode)
  );
}

export function getBodyCameraPresentationTransform(mirrored = BODY_CAMERA_PRESENTATION_MIRRORED) {
  return mirrored ? "scaleX(-1)" : "none";
}
