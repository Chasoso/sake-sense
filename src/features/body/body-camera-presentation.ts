import type { BodyCaptureStatus } from "./body-capture-layout";

export type CameraFacingMode = "user" | "environment";

export const BODY_CAMERA_DEFAULT_FACING_MODE: CameraFacingMode = "user";
export const BODY_CAMERA_PRESENTATION_MIRRORED = true;

export function canSwitchBodyCamera(status: BodyCaptureStatus, countdownActive: boolean): boolean {
  return status === "ready" && !countdownActive;
}

export function shouldMirrorBodyCameraPresentation(actualFacingMode: string | undefined): boolean {
  if (actualFacingMode === "environment") return false;
  return true;
}

export function isConfirmedCameraSwitchAvailable(
  videoInputCount: number,
  actualFacingMode: string | undefined,
): boolean {
  return videoInputCount > 1 && (actualFacingMode === "user" || actualFacingMode === "environment");
}

export function isSameCameraDevice(
  previousDeviceId: string | undefined,
  nextDeviceId: string | undefined,
): boolean {
  return Boolean(previousDeviceId) && Boolean(nextDeviceId) && previousDeviceId === nextDeviceId;
}

export function isCameraSwitchAccepted(
  previousRequestedMode: CameraFacingMode,
  requestedMode: CameraFacingMode,
  previousActualMode: string | undefined,
  actualMode: string | undefined,
  sameDevice: boolean,
): boolean {
  if (previousRequestedMode === requestedMode) return true;
  return actualMode === requestedMode && !sameDevice && previousActualMode !== actualMode;
}

export function getBodyCameraPresentationTransform(mirrored = BODY_CAMERA_PRESENTATION_MIRRORED) {
  return mirrored ? "scaleX(-1)" : "none";
}
