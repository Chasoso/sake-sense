import { describe, expect, it } from "vitest";
import {
  humanizeRepresentation,
  humanizeSensoryDimension,
  humanizeSignalSource,
} from "./translation-trail";

describe("translation trail presentation", () => {
  it("humanizes known sensory dimensions while retaining internal values", () => {
    expect(
      humanizeSensoryDimension({
        dimensionId: "duration",
        polarity: "short",
      }),
    ).toEqual({ label: "短く終わる感じ", internal: "duration:short" });
  });

  it("keeps multiple sensory hints in stable order", () => {
    expect(
      humanizeRepresentation({
        dimensions: [
          { dimensionId: "duration", polarity: "short", reason: "test" },
          { dimensionId: "shape", polarity: "sharp", reason: "test" },
        ],
        tags: [],
      }).map((item) => item.label),
    ).toEqual(["短く終わる感じ", "鋭く終わる動き"]);
  });

  it("uses human-readable source labels", () => {
    expect(humanizeSignalSource("voice")).toBe("声から見えた手がかり");
    expect(humanizeSignalSource("gesture")).toBe("動きから見えた手がかり");
  });
});
