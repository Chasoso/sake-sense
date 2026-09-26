export type AdminPresentationItem = Record<string, unknown> & { id?: string };

const LABELS: Record<string, string> = {
  published: "公開中",
  draft: "下書き",
  archived: "アーカイブ",
  regular: "通常",
  seasonal: "季節限定",
  unknown: "不明",
  direct: "直接",
  "accepted-variant": "承認済み変形",
  weak: "弱い根拠",
  rejected: "却下",
};

export function statusLabel(value: string): string {
  return LABELS[value] ?? value;
}

export function displayName(item: AdminPresentationItem, fallback = "-"): string {
  return String(
    item.displayName ?? item.name ?? item.sourceName ?? item.title ?? item.id ?? fallback,
  );
}

export function relationLabel(
  items: readonly AdminPresentationItem[],
  id: unknown,
  fallback = "-",
): string {
  const normalizedId = String(id ?? "");
  if (!normalizedId) return fallback;
  const item = items.find((candidate) => String(candidate.id ?? "") === normalizedId);
  return item ? displayName(item, normalizedId) : normalizedId;
}

export function selectOptions(items: readonly AdminPresentationItem[]) {
  return items
    .filter((item) => item.id)
    .map((item) => ({ value: String(item.id), label: displayName(item) }));
}
