import { describe, expect, it } from "vitest";
import { runLocalExperiment } from "./experiment";
import type { GesturePoint } from "./gesture";
import type { VoiceFeatures } from "./voice";

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
      error: "ポインターを一筆描いてから試してください。",
    });

    const result = runLocalExperiment("未知", shortSharpStroke);
    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.interpretation).toBe("gesture-only");
    expect(result.message).not.toContain("%");
    expect(result.candidates[0].explanation).toContain("動きから");
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
});
