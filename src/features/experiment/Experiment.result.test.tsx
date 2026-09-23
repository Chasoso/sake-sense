import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExperimentResult } from "../../domain/experiment";
import { Result } from "./Experiment";

const UNCERTAINTY_NOTE = "※候補となる言葉であり、味わいを確定するものではありません。";

function createResult(inputSource: ExperimentResult["inputSource"]): ExperimentResult {
  return {
    expression: inputSource === "voice" ? "テスト入力" : "",
    inputSource,
    voiceFeatures: null,
    bodyFeatures: inputSource === "body" ? ({} as never) : null,
    gesture: {
      pointCount: 2,
      durationMs: 100,
      pathLength: 10,
      averageSpeed: 0.1,
      spread: 10,
      horizontalDirectionChanges: 0,
      endingSpeedRatio: 0.5,
      abruptEnding: false,
    },
    representation: { dimensions: [], tags: [] },
    candidates: [
      {
        entry: {
          id: "nameraka",
          displayTerm: "なめらか",
          definitionSummary: "内部向けの辞書説明",
        } as never,
        matchedBy: inputSource === "voice" ? "voice" : "gesture",
        explanation: "Official source explicitly uses なめらか.",
      },
    ],
    sakeProducts: [
      {
        product: {
          id: "product-1",
          name: "テスト商品",
          breweryName: "テスト酒蔵",
          descriptionSummary: "短い商品説明",
          sourceUrl: "https://example.com/product-1",
          sourceName: "公式情報",
        } as never,
        matchedTermIds: ["nameraka"],
        matchedReferences: [
          {
            termId: "nameraka",
            evidenceStatus: "direct",
            rationale: "内部向けの根拠説明",
          },
        ],
        whyShown: "この商品は、候補語とterm参照が重なるため表示しています。",
      } as never,
    ],
    interpretation: "gesture-only",
    message: "",
  };
}

function renderResult(inputSource: ExperimentResult["inputSource"]): string {
  return renderToStaticMarkup(
    <Result result={createResult(inputSource)} onTryAgain={() => undefined} />,
  );
}

describe("Result concise presentation", () => {
  it.each(["gesture", "body", "voice"] as const)(
    "keeps legacy rationale out of the normal %s result UI",
    (inputSource) => {
      const markup = renderResult(inputSource);
      const normalMarkup = markup.replace(/<details[\s\S]*?<\/details>/, "");
      const text = normalMarkup.replace(/<[^>]+>/g, "");

      expect(normalMarkup).not.toContain("translation-step--expression");
      expect(text).not.toContain("声で表現しました");
      expect(text).not.toContain("term参照");
      expect(text).not.toContain("Official source explicitly uses");
      expect(text).not.toContain("この商品は、候補語とterm参照が重なるため表示しています。");
      expect(text.match(new RegExp(UNCERTAINTY_NOTE, "g"))).toHaveLength(1);
      expect(text).toContain("なめらか ｜ 公式表現");
      expect(text).toContain("商品情報（公式）");
      expect(markup).toContain("開発者向け詳細");
    },
  );
});
