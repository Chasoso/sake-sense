import { describe, expect, it } from "vitest";
import { runLocalExperiment } from "./experiment";
import type { GesturePoint } from "./gesture";
import type { VoiceFeatures } from "./voice";
import type { BodyMovementFeatures } from "./body";

const shortSharpStroke: GesturePoint[] = [
  { x: 10, y: 40, t: 0 },
  { x: 80, y: 40, t: 100 },
  { x: 160, y: 40, t: 120 },
];

const longGradualStroke: GesturePoint[] = [
  { x: 0, y: 0, t: 0 },
  { x: 100, y: 0, t: 200 },
  { x: 200, y: 0, t: 400 },
  { x: 300, y: 0, t: 600 },
  { x: 310, y: 0, t: 700 },
  { x: 320, y: 0, t: 800 },
  { x: 330, y: 0, t: 900 },
  { x: 340, y: 0, t: 1000 },
];

const shortVoice: VoiceFeatures = {
  durationMs: 400,
  averageIntensity: 0.4,
  pauseCount: 0,
  endingBehavior: "maintained",
};
const longVoice: VoiceFeatures = { ...shortVoice, durationMs: 1200 };
const bodyFeatures: BodyMovementFeatures = {
  frameCount: 12,
  captureDurationMs: 3000,
  activeDurationMs: 1200,
  totalMovement: 3,
  averageSpeed: 0.0025,
  peakSpeed: 0.004,
  spread: 3,
  hasMeaningfulMovement: true,
  activeJointCount: 4,
  endingSpeedRatio: 0.9,
  endingBehavior: "abrupt",
};

describe("EXP-001 deterministic pipeline", () => {
  it("maps a known everyday expression and gesture to candidates", () => {
    const result = runLocalExperiment("スッ", shortSharpStroke);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.candidates[0].entry.id).toBe("kire");
    expect(result.candidates[0].matchedBy).toBe("both");
    expect(result.candidates[0].explanation).toContain("動き");
    expect(result.candidates[0].explanation).not.toContain("ジェスチャーから");
    expect(result.interpretation).toBe("aligned");
  });

  it("keeps conflicting signals as multiple candidates", () => {
    const result = runLocalExperiment("じわ〜", shortSharpStroke);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.interpretation).toBe("mixed-signals");
    expect(result.candidates.map((candidate) => candidate.entry.id)).toEqual([
      "atoaji",
      "kire",
      "sanmi",
    ]);
  });

  it("handles unknown and invalid input without fake certainty", () => {
    expect(runLocalExperiment("", shortSharpStroke)).toEqual({
      error: "まず、音や感覚を表す短い言葉を入力してください。",
    });
    expect(runLocalExperiment("未知", [])).toEqual({
      error:
        "\u52d5\u304d\u3067\u8868\u73fe\u3057\u3066\u304b\u3089\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    });

    const result = runLocalExperiment("未知", shortSharpStroke);
    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.interpretation).toBe("gesture-only");
    expect(result.message).not.toContain("%");
    expect(result.candidates[0].explanation).toContain("動きから");
  });

  it("accepts one valid stroke instead of counting strokes as points", () => {
    const result = runLocalExperiment("譛ｪ遏･", [
      { x: 10, y: 10, t: 0 },
      { x: 20, y: 10, t: 100 },
      { x: 30, y: 10, t: 200 },
    ]);

    expect(result).not.toHaveProperty("error");
  });

  it("rejects empty, tap-only, and zero-length gesture input", () => {
    const tap = { x: 10, y: 10, t: 0 };
    const cases = [[], [[]], [tap], [[tap], [{ ...tap, x: 20 }]], [tap, { ...tap }]];

    for (const points of cases) {
      expect(runLocalExperiment("譛ｪ遏･", points)).toEqual({
        error:
          "\u52d5\u304d\u3067\u8868\u73fe\u3057\u3066\u304b\u3089\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      });
    }
  });

  it("accepts multiple strokes when at least one stroke contains movement", () => {
    const result = runLocalExperiment("譛ｪ遏･", [
      [{ x: 10, y: 10, t: 0 }],
      [
        { x: 20, y: 20, t: 100 },
        { x: 40, y: 20, t: 200 },
      ],
    ]);

    expect(result).not.toHaveProperty("error");
  });

  it("connects voice duration to the existing duration representation", () => {
    const short = runLocalExperiment("", longGradualStroke, shortVoice);
    const long = runLocalExperiment("", longGradualStroke, longVoice);

    expect("error" in short).toBe(false);
    expect("error" in long).toBe(false);
    if ("error" in short || "error" in long) return;
    expect(short.inputSource).toBe("voice");
    expect(short.representation.dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "short" }),
    );
    expect(long.representation.dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "duration", polarity: "lingering" }),
    );
    expect(short.voiceFeatures).toEqual(shortVoice);
  });

  it("keeps agreeing voice and gesture signals as multiple signals", () => {
    const result = runLocalExperiment("", shortSharpStroke, shortVoice);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.find((candidate) => candidate.entry.id === "kire")?.matchedBy).toBe(
      "multiple-signals",
    );
    expect(result.interpretation).toBe("voice-and-gesture");
    expect(
      result.candidates.find((candidate) => candidate.entry.id === "kire")?.explanation,
    ).toContain("声と動きの両方");
  });

  it("attributes a candidate supported only by voice to voice", () => {
    const result = runLocalExperiment("", longGradualStroke, shortVoice);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    const voiceCandidate = result.candidates.find((candidate) => candidate.entry.id === "kire");
    expect(voiceCandidate?.matchedBy).toBe("voice");
    expect(voiceCandidate?.explanation).toContain("声の長さ");
    expect(voiceCandidate?.explanation).not.toContain("動きから");
  });

  it("keeps conflicting voice and gesture duration hints visible", () => {
    const result = runLocalExperiment("", shortSharpStroke, longVoice);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.interpretation).toBe("mixed-signals");
    expect(result.candidates.map((candidate) => candidate.entry.id)).toContain("atoaji");
    expect(result.candidates.map((candidate) => candidate.entry.id)).toContain("kire");
  });

  it("preserves the text fallback when voice is unavailable", () => {
    const result = runLocalExperiment("スッ", shortSharpStroke, null);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.inputSource).toBe("text");
    expect(result.voiceFeatures).toBeNull();
  });

  it("combines voice hints with a multi-stroke movement", () => {
    const result = runLocalExperiment(
      "",
      [
        [
          { x: 10, y: 40, t: 0 },
          { x: 80, y: 40, t: 100 },
        ],
        [
          { x: 200, y: 100, t: 500 },
          { x: 260, y: 100, t: 600 },
        ],
      ],
      shortVoice,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.gesture.pointCount).toBe(4);
    expect(result.candidates.some((candidate) => candidate.matchedBy === "multiple-signals")).toBe(
      true,
    );
  });

  it("connects a grounded candidate to Ishikawa sake products", () => {
    const result = runLocalExperiment("スッ", shortSharpStroke);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.sakeProducts.length).toBeGreaterThan(0);
    expect(result.sakeProducts[0].product.provenance.length).toBeGreaterThan(0);
    expect(result.sakeProducts[0].matchedTermIds).toContain("kire");
  });

  it("allows a voice-only path when microphone input has usable duration", () => {
    const result = runLocalExperiment("", [], shortVoice);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.inputSource).toBe("voice");
    expect(result.gesture.pointCount).toBe(0);
    expect(result.sakeProducts.length).toBeGreaterThan(0);
  });

  it("reports the sample limitation when no product supports a candidate", () => {
    const result = runLocalExperiment("未登録", longGradualStroke);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.sakeProducts).toEqual([]);
  });

  it("explains a candidate with a human-readable sensory hint", () => {
    const result = runLocalExperiment("スッ", shortSharpStroke);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    const kire = result.candidates.find((candidate) => candidate.entry.id === "kire");
    expect(kire?.explanation).toContain("短く終わる感じ");
    expect(kire?.explanation).not.toContain("duration:short");
  });

  it("connects body movement through the existing candidate and product path", () => {
    const result = runLocalExperiment("", [], null, bodyFeatures);

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.inputSource).toBe("body");
    expect(result.representation.dimensions).toContainEqual(
      expect.objectContaining({ dimensionId: "weight", polarity: "heavy" }),
    );
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.sakeProducts.length).toBeGreaterThan(0);
  });

  it("rejects an unusable body capture", () => {
    const result = runLocalExperiment("", [], null, {
      ...bodyFeatures,
      frameCount: 1,
      captureDurationMs: 0,
      activeDurationMs: 0,
      totalMovement: 0,
      hasMeaningfulMovement: false,
      endingBehavior: "unknown",
    });

    expect(result).toEqual({ error: "動きで表現してから試してください。" });
  });
});
