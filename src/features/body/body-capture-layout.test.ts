import { describe, expect, it } from "vitest";
import { getBodyCaptureLayout } from "./body-capture-layout";

describe("Body capture layout states", () => {
  it("keeps every non-result capture status in the fullscreen Body shell", () => {
    for (const status of [
      "idle",
      "loading",
      "ready",
      "capturing",
      "captured",
      "denied",
      "unavailable",
    ] as const) {
      expect(getBodyCaptureLayout(status)).toBe("body-shell");
    }
  });
});
