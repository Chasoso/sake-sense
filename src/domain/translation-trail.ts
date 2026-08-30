import type { GestureRepresentation } from "./gesture";

type DimensionForPresentation = {
  dimensionId: string;
  polarity: string;
};

export type TranslationTrailItem = {
  label: string;
  internal: string;
};

export function humanizeSensoryDimension(
  dimension: DimensionForPresentation,
): TranslationTrailItem {
  const labels: Record<string, string> = {
    "duration:short": "\u77ed\u304f\u7d42\u308f\u308b\u611f\u3058",
    "duration:lingering": "\u4f59\u97fb\u304c\u6b8b\u308b\u611f\u3058",
    "shape:sharp": "\u92ed\u304f\u7d42\u308f\u308b\u52d5\u304d",
    "shape:round": "\u4e38\u307f\u306e\u3042\u308b\u52d5\u304d",
    "weight:light": "\u8efd\u3084\u304b\u306a\u5e83\u304c\u308a",
    "weight:heavy": "\u5927\u304d\u304f\u5e83\u304c\u308b\u52d5\u304d",
  };
  const internal = `${dimension.dimensionId}:${dimension.polarity}`;
  return { label: labels[internal] ?? internal, internal };
}

export function humanizeRepresentation(
  representation: GestureRepresentation,
): TranslationTrailItem[] {
  const seen = new Set<string>();
  return representation.dimensions.flatMap((dimension) => {
    const item = humanizeSensoryDimension(dimension);
    if (seen.has(item.internal)) return [];
    seen.add(item.internal);
    return [item];
  });
}

export function humanizeSignalSource(
  matchedBy: "expression" | "voice" | "gesture" | "both" | "multiple-signals",
): string {
  const labels = {
    expression: "\u65e5\u5e38\u8a9e\u304b\u3089\u898b\u3048\u305f\u624b\u304c\u304b\u308a",
    voice: "\u58f0\u304b\u3089\u898b\u3048\u305f\u624b\u304c\u304b\u308a",
    gesture: "\u52d5\u304d\u304b\u3089\u898b\u3048\u305f\u624b\u304c\u304b\u308a",
    both: "\u8907\u6570\u306e\u8868\u73fe\u304c\u91cd\u306a\u3063\u305f\u5019\u88dc",
    "multiple-signals":
      "\u58f0\u3068\u52d5\u304d\u304c\u91cd\u306a\u3063\u305f\u624b\u304c\u304b\u308a",
  };
  return labels[matchedBy];
}
