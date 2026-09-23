import type { ExperimentResult } from "../../domain/experiment";
import type { SakeTermReference } from "../../domain/sake-product-matching";

const GESTURE_TERM_SUMMARIES: Record<string, string> = {
  atoaji: "飲み込んだ後に残る味わいを表す言葉。",
  nameraka: "口当たりや舌触りが滑らかなことを表す言葉。",
  marui: "刺激が少なく、丸みのある口当たりを表す言葉。",
  tanrei: "軽快で雑味が少ない味わいを表す言葉。",
};

export function isGestureResult(
  result: Pick<ExperimentResult, "inputSource" | "sensoryBridge">,
): boolean {
  return result.inputSource === "gesture" || result.sensoryBridge?.modality === "gesture";
}

export type ResultPresentationPolicy = {
  isGesture: boolean;
  introduction: string;
  observedLabel: string;
  candidateHeading: string;
  productHeading: string;
  productDescription: string;
};

export function getResultPresentationPolicy(
  result: Pick<ExperimentResult, "inputSource" | "sensoryBridge" | "bodyFeatures">,
  hasCandidates: boolean,
): ResultPresentationPolicy {
  const gesture = isGestureResult(result);
  const body = Boolean(result.bodyFeatures);
  return {
    isGesture: gesture,
    introduction: gesture
      ? "指の動きから、日本酒の言葉への入口を探しました。"
      : hasCandidates
        ? "感じたことから、日本酒の言葉への入口を探しました。"
        : "観測した動きや表現をもとに、無理のない範囲で整理しました。",
    observedLabel: body ? "こんな動きでした" : gesture ? "感じられた特徴" : "こんな表現でした",
    candidateHeading: gesture ? "動きから連想される日本酒の言葉" : "日本酒の言葉で言うと",
    productHeading: gesture
      ? "この言葉が使われている石川の日本酒"
      : "この言葉を実際の石川の日本酒で確かめる候補",
    productDescription: gesture
      ? "公式情報で、この言葉を確認できる商品です。おすすめ順ではありません。"
      : "候補語と出典付きサンプルのterm参照が重なった商品を表示しています。おすすめや順位付けではありません。",
  };
}

export function getGestureCandidateSummary(termId: string, fallback: string): string {
  return GESTURE_TERM_SUMMARIES[termId] ?? fallback;
}

export function getCompactEvidenceLabel(status: SakeTermReference["evidenceStatus"]): string {
  if (status === "direct") return "公式表現";
  if (status === "accepted-variant") return "承認済み表現";
  if (status === "weak") return "参照用の弱い根拠";
  return "採用しない表記";
}
