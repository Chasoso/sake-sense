import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import {
  extractGestureFeatures,
  gestureToRepresentation,
  type GesturePoint,
  type GestureRepresentation,
} from "./gesture";
import type { GestureFeatures, GestureInput } from "./gesture";
import { voiceToRepresentation, type VoiceFeatures } from "./voice";
import { findSakeProductMatches, type SakeProductMatch } from "./sake-product-matching";
import { humanizeSensoryDimension } from "./translation-trail";

type DictionaryEntry = (typeof dictionaryData.entries)[number];

function candidateExplanation(
  matchedBy: "expression" | "voice" | "gesture" | "both" | "multiple-signals",
  dimensionText: string,
  hasVoiceSignal: boolean,
  hasGestureSignal: boolean,
): string {
  if (matchedBy === "expression") return "入力された日常語からの実験的な候補です。";
  if (matchedBy === "voice") {
    return `声の長さから ${dimensionText} という実験的な手がかりで候補になりました。`;
  }
  if (matchedBy === "gesture") {
    return `動きから ${dimensionText} という手がかりで候補になりました。`;
  }
  if (matchedBy === "multiple-signals") {
    return `声と動きの両方が ${dimensionText} という手がかりで重なりました。`;
  }
  const sources = [hasVoiceSignal ? "声" : "", hasGestureSignal ? "動き" : ""]
    .filter(Boolean)
    .join("と");
  return `入力された表現と${sources}が ${dimensionText} という手がかりで重なりました。`;
}

function hasDurationConflict(
  gestureRepresentation: GestureRepresentation,
  voiceRepresentation: GestureRepresentation | null,
): boolean {
  if (!voiceRepresentation) return false;
  return voiceRepresentation.dimensions.some((voiceDimension) =>
    gestureRepresentation.dimensions.some(
      (gestureDimension) =>
        gestureDimension.dimensionId === voiceDimension.dimensionId &&
        gestureDimension.polarity !== voiceDimension.polarity,
    ),
  );
}

export type ExperimentResult = {
  expression: string;
  inputSource: "text" | "voice";
  voiceFeatures: VoiceFeatures | null;
  gesture: GestureFeatures;
  representation: GestureRepresentation;
  candidates: Array<{
    entry: DictionaryEntry;
    matchedBy: "expression" | "voice" | "gesture" | "both" | "multiple-signals";
    explanation: string;
  }>;
  sakeProducts: SakeProductMatch[];
  interpretation:
    | "aligned"
    | "mixed-signals"
    | "gesture-only"
    | "voice-only"
    | "voice-and-gesture"
    | "no-match";
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
  input: GesturePoint[] | GestureInput,
  voiceFeatures: VoiceFeatures | null = null,
): ExperimentResult | { error: string } {
  const suppliedExpression = expression;
  if (voiceFeatures && !expression.trim()) expression = "\u200b";
  if (!expression.trim()) return { error: "まず、音や感覚を表す短い言葉を入力してください。" };
  const gesture = extractGestureFeatures(input);
  const hasGestureMovement = gesture.pointCount >= 2 && gesture.pathLength > 0;
  const hasVoiceInput = voiceFeatures !== null && voiceFeatures.durationMs > 0;
  if (!hasGestureMovement && !hasVoiceInput) {
    return {
      error:
        "\u52d5\u304d\u3067\u8868\u73fe\u3057\u3066\u304b\u3089\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    };
  }
  const gestureRepresentation = hasGestureMovement
    ? gestureToRepresentation(gesture)
    : { dimensions: [], tags: [] };
  const voiceRepresentation = voiceFeatures ? voiceToRepresentation(voiceFeatures) : null;
  const representation: GestureRepresentation = {
    dimensions: [...gestureRepresentation.dimensions, ...(voiceRepresentation?.dimensions ?? [])],
    tags: [...new Set([...gestureRepresentation.tags, ...(voiceRepresentation?.tags ?? [])])],
  };
  const expressionIds = expressionCandidateIds(expression);
  const gestureIds = gestureCandidateIds(gestureRepresentation);
  const voiceIds = voiceRepresentation ? gestureCandidateIds(voiceRepresentation) : [];
  const signalIds = [...new Set([...gestureIds, ...voiceIds])];
  const allIds = [...new Set([...expressionIds, ...signalIds])];
  const entryById = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));
  const expressionSet = new Set(expressionIds);
  const gestureSet = new Set(gestureIds);
  const candidates = allIds.flatMap((id) => {
    const entry = entryById.get(id);
    if (!entry || entry.mappingStatus !== "mapped") return [];
    const hasGestureSignal = gestureSet.has(id);
    const hasVoiceSignal = voiceIds.includes(id);
    const matchedBy: "expression" | "voice" | "gesture" | "both" | "multiple-signals" =
      expressionSet.has(id) && (hasGestureSignal || hasVoiceSignal)
        ? "both"
        : expressionSet.has(id)
          ? "expression"
          : hasGestureSignal && hasVoiceSignal
            ? "multiple-signals"
            : hasVoiceSignal
              ? "voice"
              : "gesture";
    const dimensionText = entry.dimensions
      .map((dimension) => humanizeSensoryDimension(dimension).label)
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
    ].map((candidate) => ({
      ...candidate,
      explanation: candidateExplanation(matchedBy, dimensionText, hasVoiceSignal, hasGestureSignal),
    }));
  });
  const sakeProducts = findSakeProductMatches(candidates.map((candidate) => candidate.entry.id));

  const hasExpression = expressionIds.length > 0;
  const hasGesture = gestureIds.length > 0;
  const hasVoice = voiceIds.length > 0;
  const hasSignal = hasGesture || hasVoice;
  const overlap = expressionIds.some((id) => signalIds.includes(id));
  const signalsConflict = hasDurationConflict(gestureRepresentation, voiceRepresentation);
  const interpretation = !candidates.length
    ? "no-match"
    : hasVoice && hasGesture
      ? signalsConflict
        ? "mixed-signals"
        : hasExpression && overlap
          ? "aligned"
          : "voice-and-gesture"
      : !hasExpression
        ? hasVoice
          ? "voice-only"
          : "gesture-only"
        : overlap
          ? "aligned"
          : hasSignal
            ? "mixed-signals"
            : "aligned";
  const message =
    interpretation === "mixed-signals"
      ? "二つの入力は異なる手がかりを示しています。ひとつの正解に決めず、候補を並べて見てください。"
      : interpretation === "no-match"
        ? "今回の小さな辞書では直接の候補が見つかりませんでした。これは失敗ではなく、辞書の範囲を示す結果です。"
        : "これは候補 translation です。入力した感覚やあなた自身を断定するものではありません。";

  return {
    expression: suppliedExpression,
    inputSource: suppliedExpression.trim() ? "text" : "voice",
    voiceFeatures,
    gesture,
    representation,
    candidates,
    sakeProducts,
    interpretation,
    message,
  };
}
