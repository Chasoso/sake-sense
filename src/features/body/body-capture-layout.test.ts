import { describe, expect, it } from "vitest";
import { getBodyCaptureLayout } from "./body-capture-layout";

describe("Body capture layout states", () => {
  it("uses the camera-first layout only after the camera is ready", () => {
    for (const status of ["ready", "capturing", "captured"] as const) {
      expect(getBodyCaptureLayout(status)).toBe("capture");
    }
    for (const status of ["idle", "loading", "denied", "unavailable"] as const) {
      expect(getBodyCaptureLayout(status)).toBe("setup");
    }
  });
});
