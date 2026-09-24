import { describe, expect, it } from "vitest";
import {
  BODY_CAMERA_DEFAULT_FACING_MODE,
  BODY_CAMERA_PRESENTATION_MIRRORED,
  canSwitchBodyCamera,
  getBodyCameraPresentationTransform,
  isCameraSwitchAccepted,
  isConfirmedCameraSwitchAvailable,
  isSameCameraDevice,
  shouldMirrorBodyCameraPresentation,
} from "./body-camera-presentation";

describe("body camera presentation coordinates", () => {
  it("defaults to the mirrored user-facing camera policy", () => {
    expect(BODY_CAMERA_DEFAULT_FACING_MODE).toBe("user");
    expect(BODY_CAMERA_PRESENTATION_MIRRORED).toBe(true);
    expect(getBodyCameraPresentationTransform()).toBe("scaleX(-1)");
  });

  it("uses the same mirror decision for video and overlay coordinates", () => {
    expect(getBodyCameraPresentationTransform(true)).toBe("scaleX(-1)");
    expect(getBodyCameraPresentationTransform(false)).toBe("none");
  });

  it("mirrors user cameras and desktop fallbacks, but not environment cameras", () => {
    expect(shouldMirrorBodyCameraPresentation("user")).toBe(true);
    expect(shouldMirrorBodyCameraPresentation("environment")).toBe(false);
    expect(shouldMirrorBodyCameraPresentation(undefined)).toBe(true);
  });

  it("does not expose switching for an unclassified single desktop webcam", () => {
    expect(isConfirmedCameraSwitchAvailable(1, undefined)).toBe(false);
    expect(isConfirmedCameraSwitchAvailable(2, undefined)).toBe(false);
    expect(isConfirmedCameraSwitchAvailable(2, "user")).toBe(true);
  });

  it("allows switching only from a ready, non-countdown state", () => {
    expect(canSwitchBodyCamera("ready", false)).toBe(true);
    expect(canSwitchBodyCamera("ready", true)).toBe(false);
    expect(canSwitchBodyCamera("captured", false)).toBe(false);
    expect(canSwitchBodyCamera("capturing", false)).toBe(false);
    expect(canSwitchBodyCamera("loading", false)).toBe(false);
  });

  it("recognizes an ineffective switch when the effective camera is unchanged", () => {
    expect(isSameCameraDevice("camera-1", "camera-1")).toBe(true);
    expect(isSameCameraDevice(undefined, undefined)).toBe(false);
    expect(isSameCameraDevice("camera-1", "camera-2")).toBe(false);
  });

  it("accepts only a verified change to the requested facing role", () => {
    expect(isCameraSwitchAccepted("user", "environment", "user", "user", false)).toBe(false);
    expect(isCameraSwitchAccepted("user", "environment", "user", undefined, false)).toBe(false);
    expect(isCameraSwitchAccepted("user", "environment", "user", "environment", true)).toBe(false);
    expect(isCameraSwitchAccepted("user", "environment", "user", "environment", false)).toBe(true);
  });
});
