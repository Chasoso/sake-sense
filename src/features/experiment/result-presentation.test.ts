import { describe, expect, it } from "vitest";
import {
  getCompactEvidenceLabel,
  getCandidateDisplaySummary,
  getResultPresentationPolicy,
  isGestureResult,
} from "./result-presentation";

describe("result presentation policy", () => {
  it("recognizes Gesture from existing result metadata only", () => {
    expect(isGestureResult({ inputSource: "gesture", sensoryBridge: undefined })).toBe(true);
    expect(
      isGestureResult({
        inputSource: "voice",
        sensoryBridge: {
          modality: "gesture",
          input: {} as never,
          response: {} as never,
          provider: "fixture",
        },
      }),
    ).toBe(true);
    expect(isGestureResult({ inputSource: "voice", sensoryBridge: undefined })).toBe(false);
  });

  it("keeps concise user-facing summaries for reviewed Gesture terms", () => {
    expect(getCandidateDisplaySummary("atoaji", "internal fallback")).toBe(
      "飲み込んだ後に残る味わいを表す言葉。",
    );
    expect(getCandidateDisplaySummary("nameraka", "internal fallback")).toBe(
      "口当たりや舌触りが滑らかなことを表す言葉。",
    );
    expect(getCandidateDisplaySummary("marui", "internal fallback")).toBe(
      "刺激が少なく、丸みのある口当たりを表す言葉。",
    );
    expect(getCandidateDisplaySummary("tanrei", "internal fallback")).toBe(
      "軽快で雑味が少ない味わいを表す言葉。",
    );
  });

  it("compresses evidence labels without changing evidence status", () => {
    expect(getCompactEvidenceLabel("direct")).toBe("公式表現");
    expect(getCompactEvidenceLabel("accepted-variant")).toBe("承認済み表現");
  });

  it("keeps Gesture-only copy out of Body and Voice policies", () => {
    const gesture = getResultPresentationPolicy(
      { inputSource: "gesture", bodyFeatures: null, sensoryBridge: undefined },
      true,
    );
    const body = getResultPresentationPolicy(
      { inputSource: "body", bodyFeatures: {} as never, sensoryBridge: undefined },
      true,
    );
    const voice = getResultPresentationPolicy(
      { inputSource: "voice", bodyFeatures: null, sensoryBridge: undefined },
      true,
    );

    expect(gesture.introduction).toContain("指の動きから");
    expect(gesture.observedLabel).toBe("感じられた特徴");
    expect(gesture.candidateHeading).toBe("動きから連想される日本酒の言葉");
    expect(body.introduction).not.toContain("指の動きから");
    expect(body.introduction).toBe("身体の動きから、日本酒の言葉への入口を探しました。");
    expect(body.observedLabel).toBe("感じられた特徴");
    expect(body.candidateHeading).toBe("動きから連想される日本酒の言葉");
    expect(voice.introduction).not.toContain("指の動きから");
    expect(voice.introduction).toBe("声の特徴から、日本酒の言葉への入口を探しました。");
    expect(voice.observedLabel).toBe("感じられた特徴");
    expect(voice.candidateHeading).toBe("声から連想される日本酒の言葉");
  });
});
