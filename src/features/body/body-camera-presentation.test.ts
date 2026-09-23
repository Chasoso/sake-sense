import { describe, expect, it } from "vitest";
import {
  BODY_CAMERA_DEFAULT_FACING_MODE,
  BODY_CAMERA_PRESENTATION_MIRRORED,
  getBodyCameraPresentationTransform,
  isConfirmedCameraSwitchAvailable,
  isSameEffectiveCamera,
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
    expect(shouldMirrorBodyCameraPresentation("user", "environment")).toBe(true);
    expect(shouldMirrorBodyCameraPresentation("environment", "user")).toBe(false);
    expect(shouldMirrorBodyCameraPresentation(undefined, "user")).toBe(true);
    expect(shouldMirrorBodyCameraPresentation(undefined, "environment")).toBe(false);
  });

  it("does not expose switching for an unclassified single desktop webcam", () => {
    expect(isConfirmedCameraSwitchAvailable(1, undefined)).toBe(false);
    expect(isConfirmedCameraSwitchAvailable(2, undefined)).toBe(false);
    expect(isConfirmedCameraSwitchAvailable(2, "user")).toBe(true);
  });

  it("recognizes an ineffective switch when the effective camera is unchanged", () => {
    expect(isSameEffectiveCamera("camera-1", "camera-1", "user", "user")).toBe(true);
    expect(isSameEffectiveCamera(undefined, undefined, "user", undefined)).toBe(false);
    expect(isSameEffectiveCamera("camera-1", "camera-2", "user", "environment")).toBe(false);
  });
});
