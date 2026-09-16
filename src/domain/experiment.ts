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
import { bodyToRepresentation, type BodyMovementFeatures } from "./body";
import {
  buildSensoryBridgeInput,
  buildVoiceSensoryBridgeRequest,
  createFallbackSensoryBridgeResponse,
  createFixtureSensoryBridgeProvider,
  getSelectableSensoryTermIds,
  validateSensoryBridgeResponse,
  type SensoryBridgeRequest,
  type SensoryBridgeProviderKind,
  type SensoryBridgeResponse,
  type SensoryBridgeProvider,
} from "./sensory-bridge";

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
  inputSource: "text" | "voice" | "body";
  voiceFeatures: VoiceFeatures | null;
  bodyFeatures: BodyMovementFeatures | null;
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
  sensoryBridge?:
    | {
        modality: "body";
        input: Extract<SensoryBridgeRequest, { modality: "body" }>["input"];
        response: SensoryBridgeResponse;
        provider: SensoryBridgeProviderKind;
      }
    | {
        modality: "voice";
        input: Extract<SensoryBridgeRequest, { modality: "voice" }>["input"];
        response: SensoryBridgeResponse;
        provider: SensoryBridgeProviderKind;
      };
};

const expressionMappings: Record<string, string[]> = {
  "\u30b9\u30c3": ["kire"],
  すっ: ["kire"],
  すっと: ["kire"],
  じわ: ["atoaji"],
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
  void representation;
  return [];
}

export function runLocalExperiment(
  expression: string,
  input: GesturePoint[] | GestureInput,
  voiceFeatures: VoiceFeatures | null = null,
  bodyFeatures: BodyMovementFeatures | null = null,
): ExperimentResult | { error: string } {
  const suppliedExpression = expression;
  if ((voiceFeatures || bodyFeatures) && !expression.trim()) expression = "\u200b";
  if (!expression.trim()) return { error: "まず、音や感覚を表す短い言葉を入力してください。" };
  const gesture = extractGestureFeatures(input);
  const hasGestureMovement = gesture.pointCount >= 2 && gesture.pathLength > 0;
  const hasVoiceInput = voiceFeatures !== null && voiceFeatures.durationMs > 0;
  const hasBodyInput =
    bodyFeatures !== null &&
    bodyFeatures.frameCount >= 2 &&
    bodyFeatures.hasMeaningfulMovement &&
    bodyFeatures.activeDurationMs > 0;
  if (!hasGestureMovement && !hasVoiceInput && !hasBodyInput) {
    return {
      error:
        "\u52d5\u304d\u3067\u8868\u73fe\u3057\u3066\u304b\u3089\u8a66\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    };
  }
  const gestureRepresentation = hasGestureMovement
    ? gestureToRepresentation(gesture)
    : { dimensions: [], tags: [] };
  const bodyRepresentation = hasBodyInput ? bodyToRepresentation(bodyFeatures) : null;
  const voiceRepresentation = voiceFeatures ? voiceToRepresentation(voiceFeatures) : null;
  const representation: GestureRepresentation = {
    dimensions: [
      ...gestureRepresentation.dimensions,
      ...(bodyRepresentation?.dimensions ?? []),
      ...(voiceRepresentation?.dimensions ?? []),
    ],
    tags: [
      ...new Set([
        ...gestureRepresentation.tags,
        ...(bodyRepresentation?.tags ?? []),
        ...(voiceRepresentation?.tags ?? []),
      ]),
    ],
  };
  const expressionIds = expressionCandidateIds(expression);
  const gestureIds = gestureCandidateIds({
    dimensions: [...gestureRepresentation.dimensions, ...(bodyRepresentation?.dimensions ?? [])],
    tags: [...gestureRepresentation.tags, ...(bodyRepresentation?.tags ?? [])],
  });
  const voiceIds = voiceRepresentation ? gestureCandidateIds(voiceRepresentation) : [];
  const signalIds = [...new Set([...gestureIds, ...voiceIds])];
  const allIds = [...new Set([...expressionIds, ...signalIds])];
  const entryById = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));
  const expressionSet = new Set(expressionIds);
  const gestureSet = new Set(gestureIds);
  const candidates = allIds.flatMap((id) => {
    const entry = entryById.get(id);
    if (!entry || entry.vocabularyStatus !== "selectable") return [];
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
    const dimensionText = entry.sourceCategory;
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
  const signalsConflict = hasDurationConflict(
    {
      dimensions: [...gestureRepresentation.dimensions, ...(bodyRepresentation?.dimensions ?? [])],
      tags: [],
    },
    voiceRepresentation,
  );
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
    inputSource: suppliedExpression.trim() ? "text" : bodyFeatures ? "body" : "voice",
    voiceFeatures,
    bodyFeatures,
    gesture,
    representation,
    candidates,
    sakeProducts,
    interpretation,
    message,
  };
}

export async function runBodySemanticExperiment(
  bodyFeatures: BodyMovementFeatures,
  provider: SensoryBridgeProvider = createFixtureSensoryBridgeProvider(),
): Promise<ExperimentResult | { error: string }> {
  if (!bodyFeatures.hasMeaningfulMovement || bodyFeatures.activeDurationMs <= 0) {
    return { error: "動きで表現してから試してください。" };
  }
  const input = buildSensoryBridgeInput(bodyFeatures);
  const request = {
    modality: "body" as const,
    input,
    allowedTermIds: getSelectableSensoryTermIds(),
  };
  let response: SensoryBridgeResponse;
  let providerStatus: SensoryBridgeProviderKind = provider.kind;
  try {
    const validation = validateSensoryBridgeResponse(await provider.interpret(request));
    if (validation.ok) response = validation.value;
    else {
      response = createFallbackSensoryBridgeResponse(input, validation.error);
      providerStatus = "fallback";
    }
  } catch {
    response = createFallbackSensoryBridgeResponse(input);
    providerStatus = "fallback";
  }
  const entryById = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));
  const candidates = response.candidateTermIds.flatMap((id) => {
    const entry = entryById.get(id);
    if (!entry) return [];
    return [
      {
        entry,
        matchedBy: "gesture" as const,
        explanation: response.reason,
      },
    ];
  });
  return {
    expression: "",
    inputSource: "body",
    voiceFeatures: null,
    bodyFeatures,
    gesture: extractGestureFeatures([]),
    representation: { dimensions: [], tags: [] },
    candidates,
    sakeProducts: findSakeProductMatches(response.candidateTermIds),
    interpretation: candidates.length ? "gesture-only" : "no-match",
    message:
      providerStatus === "fixture"
        ? "現在は実AIには接続せず、ローカルfixtureで観測から言葉への橋渡しを再現しています。"
        : providerStatus === "ai"
          ? "AIは味を判定しているのではなく、観測した身体表現を日本酒語へ実験的に橋渡ししています。"
          : "日本酒語への無理のない対応はまだ見つかっていません。これは失敗ではなく、観測と解釈を分けた結果です。",
    sensoryBridge: {
      modality: "body" as const,
      input,
      response,
      provider: providerStatus,
    },
  };
}

export async function runVoiceSemanticExperiment(
  baseResult: ExperimentResult,
  voiceFeatures: VoiceFeatures,
  provider: SensoryBridgeProvider = createFixtureSensoryBridgeProvider(),
): Promise<ExperimentResult> {
  const request = buildVoiceSensoryBridgeRequest(voiceFeatures);
  let response: SensoryBridgeResponse;
  let providerStatus: SensoryBridgeProviderKind = provider.kind;
  try {
    const validation = validateSensoryBridgeResponse(await provider.interpret(request));
    if (validation.ok) response = validation.value;
    else {
      response = createFallbackSensoryBridgeResponse(request.input, validation.error);
      providerStatus = "fallback";
    }
  } catch {
    response = createFallbackSensoryBridgeResponse(request.input);
    providerStatus = "fallback";
  }
  const entryById = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));
  const candidates = response.candidateTermIds.flatMap((id) => {
    const entry = entryById.get(id);
    return entry ? [{ entry, matchedBy: "voice" as const, explanation: response.reason }] : [];
  });
  return {
    ...baseResult,
    candidates,
    sakeProducts: findSakeProductMatches(response.candidateTermIds),
    interpretation: candidates.length ? "voice-only" : "no-match",
    message:
      providerStatus === "fixture"
        ? "現在は実AIには接続せず、ローカルfixtureで声の特徴から言葉への橋渡しを再現しています。"
        : providerStatus === "ai"
          ? "AIは味を判定するのではなく、観測した声の特徴を言葉へ橋渡ししています。"
          : "日本酒語への橋渡しを利用できなかったため、観測した声の特徴のみ表示しています。",
    sensoryBridge: {
      modality: "voice",
      input: request.input,
      response,
      provider: providerStatus,
    },
  };
}
