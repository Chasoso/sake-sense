import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import {
  BODY_BROAD_MOVEMENT_THRESHOLD,
  BODY_SHORT_DURATION_THRESHOLD_MS,
  type BodyMovementFeatures,
} from "./body";

export type SensoryBridgeInput = {
  duration: "short" | "lingering" | "unknown";
  ending: "abrupt" | "gradual" | "continued" | "unknown";
  expansion: "expanding" | "contracting" | "unknown";
  direction: "upward" | "downward" | "lateral" | "unknown";
  repetition: "single" | "repeated" | "unknown";
  participation: "localized" | "broad" | "unknown";
  spread: "compact" | "broad" | "unknown";
  speed: "sustained-fast" | "unknown";
};

export type SensoryBridgeResponse = {
  sensoryExpressions: string[];
  candidateTermIds: string[];
  unmappedFeatures: string[];
  reason: string;
};

export type SensoryBridgeRawResponse = SensoryBridgeResponse | string;
export type SensoryBridgeProviderKind = "fixture" | "fallback" | "ai";
export type SensoryBridgeImplementationKind = Exclude<SensoryBridgeProviderKind, "fallback">;

export type SensoryDictionaryContext = Array<{
  id: string;
  displayTerm: string;
  definitionSummary: string;
  dimensions: Array<{ dimensionId: string; polarity: string }>;
}>;

export type SensoryBridgeRequest = {
  input: SensoryBridgeInput;
  dictionaryContext: SensoryDictionaryContext;
};

export interface SensoryBridgeProvider {
  kind: SensoryBridgeImplementationKind;
  interpret(request: SensoryBridgeRequest): Promise<SensoryBridgeRawResponse>;
}

export function serializeSensoryBridgeRequest(request: SensoryBridgeRequest): string {
  return JSON.stringify({
    input: request.input,
    dictionaryContext: request.dictionaryContext,
  });
}

export function createHttpSensoryBridgeProvider(
  endpoint: string,
  timeoutMs = 8000,
): SensoryBridgeProvider {
  return {
    kind: "ai",
    async interpret(request): Promise<SensoryBridgeRawResponse> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.max(timeoutMs, 1));
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: serializeSensoryBridgeRequest(request),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`semantic bridge request failed: ${response.status}`);
        return (await response.json()) as SensoryBridgeRawResponse;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export type SensoryBridgeValidation =
  | { ok: true; value: SensoryBridgeResponse }
  | { ok: false; error: string };

export type SensoryBridgeProviderPresentation = {
  heading: string;
  explanation: string;
};

const responseKeys = new Set([
  "sensoryExpressions",
  "candidateTermIds",
  "unmappedFeatures",
  "reason",
]);

export function buildSensoryBridgeInput(features: BodyMovementFeatures): SensoryBridgeInput {
  return {
    duration: !features.hasMeaningfulMovement
      ? "unknown"
      : features.activeDurationMs <= BODY_SHORT_DURATION_THRESHOLD_MS
        ? "short"
        : "lingering",
    ending: features.hasMeaningfulMovement ? features.endingBehavior : "unknown",
    expansion: features.hasMeaningfulMovement ? features.motionShape.expansion : "unknown",
    direction: features.hasMeaningfulMovement ? features.motionShape.dominantDirection : "unknown",
    repetition: features.hasMeaningfulMovement ? features.motionShape.repetition : "unknown",
    participation: features.hasMeaningfulMovement ? features.motionShape.participation : "unknown",
    spread: !features.hasMeaningfulMovement
      ? "unknown"
      : features.spread >= BODY_BROAD_MOVEMENT_THRESHOLD
        ? "broad"
        : "compact",
    speed: features.hasSustainedFastMovement === true ? "sustained-fast" : "unknown",
  };
}

export function serializeSensoryDictionaryContext(): SensoryDictionaryContext {
  return dictionaryData.entries
    .filter((entry) => entry.mappingStatus === "mapped")
    .map((entry) => ({
      id: entry.id,
      displayTerm: entry.displayTerm,
      definitionSummary: entry.definitionSummary,
      dimensions: entry.dimensions,
    }));
}

export function getSelectableSensoryTermIds(): string[] {
  return serializeSensoryDictionaryContext().map((entry) => entry.id);
}

export function presentSensoryBridgeProvider(
  provider: SensoryBridgeProviderKind,
): SensoryBridgeProviderPresentation {
  if (provider === "fixture") {
    return {
      heading: "03 · 感覚表現の橋渡し（ローカル実験）",
      explanation:
        "現在は実AIには接続せず、同じ入出力契約を確認するローカルfixtureで橋渡しを再現しています。",
    };
  }
  if (provider === "fallback") {
    return {
      heading: "03 · 感覚表現の橋渡し（観測のみ）",
      explanation: "感覚表現の橋渡しを利用できなかったため、観測した動きのみ表示しています。",
    };
  }
  return {
    heading: "03 · AIによる感覚表現の橋渡し",
    explanation: "AIは味を判定しているのではなく、観測した身体表現を言葉へ橋渡ししています。",
  };
}

export function buildSensoryBridgeInstruction(request: SensoryBridgeRequest): string {
  const allowedContext = request.dictionaryContext
    .map(
      (entry) =>
        `- id: ${entry.id}\n  term: ${entry.displayTerm}\n  definition: ${entry.definitionSummary}\n  dimensions: ${entry.dimensions.map(({ dimensionId, polarity }) => `${dimensionId}:${polarity}`).join(", ") || "none"}`,
    )
    .join("\n");
  return [
    "身体表現の観測を、可能性のある感覚表現へ橋渡ししてください。これは味の測定・判定ではありません。",
    "提供された辞書IDだけを候補にし、候補がなければ空配列を返してください。商品推薦、順位、好み、感情、人格、健康、酩酊の推測は禁止です。",
    "根拠の弱い特徴はunmappedFeaturesへ残し、観測事実と実験的解釈をreasonで区別してください。科学的確実性を主張しないでください。",
    "選択可能な日本酒語候補（この一覧以外のIDは禁止）:\n" + allowedContext,
    `観測入力: ${JSON.stringify(request.input)}`,
  ].join("\n");
}

function parseRawResponse(raw: SensoryBridgeRawResponse): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function validateSensoryBridgeResponse(
  raw: SensoryBridgeRawResponse,
): SensoryBridgeValidation {
  const parsed = parseRawResponse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "橋渡し応答の形式を確認できませんでした。" };
  }
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).some((key) => !responseKeys.has(key))) {
    return { ok: false, error: "橋渡し応答に対応していない項目が含まれています。" };
  }
  const fields = ["sensoryExpressions", "candidateTermIds", "unmappedFeatures"];
  if (
    fields.some(
      (field) =>
        !Array.isArray(record[field]) ||
        (record[field] as unknown[]).some((value) => typeof value !== "string"),
    ) ||
    typeof record.reason !== "string" ||
    !record.reason.trim()
  ) {
    return { ok: false, error: "橋渡し応答の必須項目が不正です。" };
  }
  const candidateTermIds = record.candidateTermIds as string[];
  const allowedIds = new Set(getSelectableSensoryTermIds());
  if (
    new Set(candidateTermIds).size !== candidateTermIds.length ||
    candidateTermIds.some((id) => !allowedIds.has(id))
  ) {
    return { ok: false, error: "橋渡し応答に辞書外または重複した候補が含まれています。" };
  }
  return {
    ok: true,
    value: {
      sensoryExpressions: record.sensoryExpressions as string[],
      candidateTermIds,
      unmappedFeatures: record.unmappedFeatures as string[],
      reason: record.reason,
    },
  };
}

function featureList(input: SensoryBridgeInput): string[] {
  return Object.entries(input)
    .filter(([, value]) => value !== "unknown")
    .map(([key, value]) => `${key}:${value}`);
}

export function createFixtureSensoryBridgeProvider(): SensoryBridgeProvider {
  return {
    kind: "fixture",
    async interpret({ input }: SensoryBridgeRequest): Promise<SensoryBridgeRawResponse> {
      const unmappedFeatures = featureList(input);
      if (input.duration === "unknown") {
        return {
          sensoryExpressions: [],
          candidateTermIds: [],
          unmappedFeatures,
          reason: "はっきりした動きから、日本酒語への無理のない対応はまだ見つかっていません。",
        };
      }
      if (input.direction === "lateral" && input.repetition === "repeated") {
        return {
          sensoryExpressions: ["ゆらぎながら続く感じ"],
          candidateTermIds: [],
          unmappedFeatures: ["direction:lateral", "repetition:repeated", "spread:" + input.spread],
          reason:
            "左右の反復は観測できましたが、それだけで濃醇や淡麗と結びつける根拠はありません。",
        };
      }
      if (input.ending === "abrupt" && input.duration === "short") {
        return {
          sensoryExpressions: ["短く切り替わる感じ"],
          candidateTermIds: ["kire"],
          unmappedFeatures: unmappedFeatures.filter((feature) => !feature.startsWith("ending:")),
          reason:
            "短い動きと実際に観測された急な停止を、切れが良いという候補へ実験的につないでいます。",
        };
      }
      if (input.ending === "gradual" && input.duration === "lingering") {
        return {
          sensoryExpressions: ["余韻が残るような感じ"],
          candidateTermIds: ["atoaji"],
          unmappedFeatures: unmappedFeatures.filter((feature) => !feature.startsWith("ending:")),
          reason: "長く続き、ゆっくり収まった動きを、あと味という候補へ実験的につないでいます。",
        };
      }
      return {
        sensoryExpressions: input.expansion === "expanding" ? ["外へほどけていく感じ"] : [],
        candidateTermIds: [],
        unmappedFeatures,
        reason:
          "観測した動きは表示できますが、現在の小さな辞書へ無理なくつなげる候補はありません。",
      };
    },
  };
}

export function createFallbackSensoryBridgeResponse(
  input: SensoryBridgeInput,
  reason = "橋渡しを利用できないため、観測した動きだけを表示します。",
): SensoryBridgeResponse {
  return {
    sensoryExpressions: [],
    candidateTermIds: [],
    unmappedFeatures: featureList(input),
    reason,
  };
}
