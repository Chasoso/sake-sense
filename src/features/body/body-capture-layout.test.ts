import { describe, expect, it } from "vitest";
import { getBodyCaptureLayout } from "./body-capture-layout";

describe("Body capture layout states", () => {
  it("keeps preparation and capture statuses in the fullscreen Body shell", () => {
    for (const status of [
      "idle",
      "loading",
      "ready",
      "capturing",
      "denied",
      "unavailable",
    ] as const) {
      expect(getBodyCaptureLayout(status)).toEqual({
        shell: "body-shell",
        surface: "viewport",
        details: "contained",
        topOverlay: "surface",
        bottomOverlay: "surface",
      });
    }
  });

  it("uses a contained review layout after capture", () => {
    expect(getBodyCaptureLayout("captured")).toEqual({
      shell: "body-shell",
      surface: "review",
      details: "contained",
      topOverlay: "surface",
      bottomOverlay: "review-actions",
    });
  });
});
