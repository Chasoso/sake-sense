import { describe, expect, it } from "vitest";
import {
  BODY_CAMERA_DEFAULT_FACING_MODE,
  BODY_CAMERA_PRESENTATION_MIRRORED,
  getBodyCameraPresentationTransform,
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
});
