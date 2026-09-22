import { describe, expect, it } from "vitest";
import {
  BODY_CAMERA_PRESENTATION_MIRRORED,
  getBodyCameraPresentationTransform,
} from "./body-camera-presentation";

describe("body camera presentation coordinates", () => {
  it("keeps the current non-mirrored camera and overlay policy", () => {
    expect(BODY_CAMERA_PRESENTATION_MIRRORED).toBe(false);
    expect(getBodyCameraPresentationTransform()).toBe("none");
  });

  it("uses the same mirror decision for video and overlay coordinates", () => {
    expect(getBodyCameraPresentationTransform(true)).toBe("scaleX(-1)");
    expect(getBodyCameraPresentationTransform(false)).toBe("none");
  });
});
