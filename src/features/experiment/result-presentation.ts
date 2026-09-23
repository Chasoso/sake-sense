import type { ExperimentResult } from "../../domain/experiment";
import type { SakeTermReference } from "../../domain/sake-product-matching";

const CANDIDATE_DISPLAY_SUMMARIES: Record<string, string> = {
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
  modality: "gesture" | "body" | "voice" | "other";
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
  const isGesture = isGestureResult(result);
  const modality = isGesture ? "gesture" : (result.sensoryBridge?.modality ?? result.inputSource);
  const isBody = modality === "body" || Boolean(result.bodyFeatures);
  const isVoice = modality === "voice";
  return {
    modality:
      modality === "gesture" || modality === "body" || modality === "voice" ? modality : "other",
    introduction: isGesture
      ? "指の動きから、日本酒の言葉への入口を探しました。"
      : isBody
        ? "身体の動きから、日本酒の言葉への入口を探しました。"
        : isVoice
          ? "声の特徴から、日本酒の言葉への入口を探しました。"
          : hasCandidates
            ? "感じたことから、日本酒の言葉への入口を探しました。"
            : "観測した動きや表現をもとに、無理のない範囲で整理しました。",
    observedLabel: isGesture || isBody || isVoice ? "感じられた特徴" : "こんな表現でした",
    candidateHeading:
      isGesture || isBody
        ? "動きから連想される日本酒の言葉"
        : isVoice
          ? "声から連想される日本酒の言葉"
          : "日本酒の言葉で言うと",
    productHeading: "この言葉が使われている石川の日本酒",
    productDescription: "公式情報で、この言葉を確認できる商品です。おすすめ順ではありません。",
  };
}

export function getCandidateDisplaySummary(termId: string, fallback: string): string {
  return CANDIDATE_DISPLAY_SUMMARIES[termId] ?? fallback;
}

export function getCompactEvidenceLabel(status: SakeTermReference["evidenceStatus"]): string {
  if (status === "direct") return "公式表現";
  if (status === "accepted-variant") return "承認済み表現";
  if (status === "weak") return "参照用の弱い根拠";
  return "採用しない表記";
}
