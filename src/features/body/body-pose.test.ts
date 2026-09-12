import { describe, expect, it } from "vitest";
import { isCameraSupported, toBodyLandmarks } from "./body-pose";

describe("body pose capture boundary", () => {
  it("converts pose landmarks to the local observable shape", () => {
    expect(toBodyLandmarks([{ x: 0.2, y: 0.3, z: -0.1, visibility: 0.9 }])).toEqual([
      { x: 0.2, y: 0.3, z: -0.1, visibility: 0.9 },
    ]);
  });

  it("reports camera capability without starting a capture", () => {
    expect(typeof isCameraSupported()).toBe("boolean");
  });
});
