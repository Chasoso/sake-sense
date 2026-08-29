import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import {
  extractGestureFeatures,
  gestureToRepresentation,
  type GesturePoint,
  type GestureRepresentation,
} from "./gesture";
import type { GestureFeatures } from "./gesture";

type DictionaryEntry = (typeof dictionaryData.entries)[number];

export type ExperimentResult = {
  expression: string;
  gesture: GestureFeatures;
  representation: GestureRepresentation;
  candidates: Array<{
    entry: DictionaryEntry;
    matchedBy: "expression" | "gesture" | "both";
    explanation: string;
  }>;
  interpretation: "aligned" | "mixed-signals" | "gesture-only" | "no-match";
  message: string;
};

const expressionMappings: Record<string, string[]> = {
  "\u30b9\u30c3": ["kire"],
  すっ: ["kire"],
  すっと: ["kire"],
  じわ: ["atoaji"],
  ふわ: ["marui", "nameraka"],
  こく: ["nojun"],
};

function normalizeExpression(expression: string): string {
  return expression
    .trim()
    .toLowerCase()
    .replace(/[〜～ー]/g, "");
}

function expressionCandidateIds(expression: string): string[] {
  return expressionMappings[normalizeExpression(expression)] ?? [];
}

function gestureCandidateIds(representation: GestureRepresentation): string[] {
  const ids = new Set<string>();
  for (const dimension of representation.dimensions) {
    if (dimension.dimensionId === "duration" && dimension.polarity === "short") ids.add("kire");
    if (dimension.dimensionId === "duration" && dimension.polarity === "lingering")
      ids.add("atoaji");
    if (dimension.dimensionId === "shape" && dimension.polarity === "sharp") ids.add("kire");
    if (dimension.dimensionId === "shape" && dimension.polarity === "sharp") ids.add("sanmi");
    if (dimension.dimensionId === "shape" && dimension.polarity === "round") ids.add("marui");
    if (dimension.dimensionId === "shape" && dimension.polarity === "round") ids.add("nameraka");
  }
  return [...ids];
}

export function runLocalExperiment(
  expression: string,
  points: GesturePoint[],
): ExperimentResult | { error: string } {
  if (!expression.trim()) return { error: "まず、音や感覚を表す短い言葉を入力してください。" };
  if (points.length < 2) return { error: "ポインターを一筆描いてから試してください。" };

  const gesture = extractGestureFeatures(points);
  const representation = gestureToRepresentation(gesture);
  const expressionIds = expressionCandidateIds(expression);
  const gestureIds = gestureCandidateIds(representation);
  const allIds = [...new Set([...expressionIds, ...gestureIds])];
  const entryById = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));
  const expressionSet = new Set(expressionIds);
  const gestureSet = new Set(gestureIds);
  const candidates = allIds.flatMap((id) => {
    const entry = entryById.get(id);
    if (!entry || entry.mappingStatus !== "mapped") return [];
    const matchedBy: "expression" | "gesture" | "both" =
      expressionSet.has(id) && gestureSet.has(id)
        ? "both"
        : expressionSet.has(id)
          ? "expression"
          : "gesture";
    const dimensionText = entry.dimensions
      .map((dimension) => `${dimension.dimensionId}:${dimension.polarity}`)
      .join(", ");
    return [
      {
        entry,
        matchedBy,
        explanation:
          matchedBy === "both"
            ? `表現とジェスチャーの両方が ${dimensionText} という手がかりで重なりました。`
            : matchedBy === "expression"
              ? "入力された日常語からの実験的な候補です。"
              : `ジェスチャーから ${dimensionText} という手がかりで候補になりました。`,
      },
    ];
  });

  const hasExpression = expressionIds.length > 0;
  const hasGesture = gestureIds.length > 0;
  const overlap = expressionIds.some((id) => gestureSet.has(id));
  const interpretation = !candidates.length
    ? "no-match"
    : !hasExpression
      ? "gesture-only"
      : overlap
        ? "aligned"
        : hasGesture
          ? "mixed-signals"
          : "aligned";
  const message =
    interpretation === "mixed-signals"
      ? "二つの入力は異なる手がかりを示しています。ひとつの正解に決めず、候補を並べて見てください。"
      : interpretation === "no-match"
        ? "今回の小さな辞書では直接の候補が見つかりませんでした。これは失敗ではなく、辞書の範囲を示す結果です。"
        : "これは候補 translation です。入力した感覚やあなた自身を断定するものではありません。";

  return { expression, gesture, representation, candidates, interpretation, message };
}
