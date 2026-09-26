import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GestureProcessingScreen, VoiceProcessingScreen } from "./processing-screens";

const voiceFeatures = {
  durationMs: 1200,
  averageIntensity: 0.4,
  pauseCount: 1,
  endingBehavior: "fading" as const,
};

const strokes = [
  [
    { x: 24, y: 112, t: 0 },
    { x: 160, y: 48, t: 120 },
    { x: 292, y: 108, t: 240 },
  ],
];

describe("dedicated processing screens", () => {
  it("keeps Voice input out of the full-screen processing composition", () => {
    const markup = renderToStaticMarkup(
      <VoiceProcessingScreen features={voiceFeatures} waveHistory={[]} onBack={() => undefined} />,
    );

    expect(markup).toContain("experience-screen--voice-transform");
    expect(markup).toContain("expression-transform--voice");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain("input-card--voice");
  });

  it("keeps Gesture input out while preserving the captured path", () => {
    const markup = renderToStaticMarkup(
      <GestureProcessingScreen strokes={strokes} onBack={() => undefined} />,
    );

    expect(markup).toContain("experience-screen--gesture-transform");
    expect(markup).toContain("expression-transform--gesture");
    expect(markup).toContain("expression-transform__gesture-path");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain("input-card--gesture");
  });
});
