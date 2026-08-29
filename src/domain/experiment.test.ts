import { describe, expect, it } from "vitest";
import { runLocalExperiment } from "./experiment";
import type { GesturePoint } from "./gesture";

const shortSharpStroke: GesturePoint[] = [
  { x: 10, y: 40, t: 0 },
  { x: 80, y: 40, t: 100 },
  { x: 90, y: 40, t: 120 },
];

describe("EXP-001 deterministic pipeline", () => {
  it("maps a known everyday expression and gesture to candidates", () => {
    const result = runLocalExperiment("スッ", shortSharpStroke);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;
    expect(result.candidates[0].entry.id).toBe("kire");
    expect(result.candidates[0].matchedBy).toBe("both");
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
  });
});
