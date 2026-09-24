import dictionaryData from "../../domain/data/sensory-dictionary.v0.1.json";
import { getSakeProducts } from "../../domain/sake-catalog";

export type DisplaySource = {
  key: string;
  sourceName: string;
  title?: string;
  url: string;
  sourceType?: string;
  reviewedAt?: string;
  category?: "terminology" | "product" | "shared";
};

type SakeProduct = ReturnType<typeof getSakeProducts>[number];

let runtimeProducts: ReadonlyArray<SakeProduct> = getSakeProducts();
let runtimeSources: DisplaySource[] | null = null;
let runtimeTerminologySources: DisplaySource[] | null = null;

const INTERNAL_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "notion.so",
  "www.notion.so",
  "notion.site",
  "www.notion.site",
]);

export function normalizeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function isPublicEvidenceUrl(value: string): boolean {
  const normalized = normalizeSourceUrl(value);
  if (!normalized) return false;
  try {
    return !INTERNAL_HOSTS.has(new URL(normalized).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function sourceKey(sourceId: string | undefined, url: string): string {
  return sourceId ? `source-id:${sourceId}` : `source-url:${normalizeSourceUrl(url) ?? url}`;
}

function addSource(
  sources: Map<string, DisplaySource>,
  source: Omit<DisplaySource, "key"> & { sourceId?: string },
): void {
  if (!isPublicEvidenceUrl(source.url)) return;
  const normalizedUrl = normalizeSourceUrl(source.url);
  if (!normalizedUrl) return;
  const key = sourceKey(source.sourceId, normalizedUrl);
  if ([...sources.values()].some((entry) => normalizeSourceUrl(entry.url) === normalizedUrl))
    return;
  if (!sources.has(key)) sources.set(key, { ...source, key, url: source.url });
}

export function collectTerminologySources(
  entries: ReadonlyArray<(typeof dictionaryData.entries)[number]> = dictionaryData.entries,
): DisplaySource[] {
  const sources = new Map<string, DisplaySource>();
  for (const entry of entries) {
    for (const provenance of entry.provenance ?? []) {
      addSource(sources, {
        sourceId: provenance.sourceId,
        sourceName: provenance.sourceName,
        url: provenance.url,
        sourceType: provenance.sourceType,
        reviewedAt: provenance.accessedOn,
      });
    }
  }
  return [...sources.values()];
}

export function collectProductSources(
  products: ReadonlyArray<SakeProduct> = getSakeProducts(),
): DisplaySource[] {
  const sources = new Map<string, DisplaySource>();
  const primaryUrls = new Set<string>();

  for (const product of products) {
    const primaryUrl = product.sourceUrl ? normalizeSourceUrl(product.sourceUrl) : null;
    if (primaryUrl) primaryUrls.add(primaryUrl);
    if (product.sourceUrl && product.sourceName) {
      addSource(sources, {
        sourceName: product.sourceName,
        url: product.sourceUrl,
        sourceType: product.sourceType,
        reviewedAt: product.sourceReviewedAt,
      });
    }
  }

  for (const product of products) {
    const primaryUrl = product.sourceUrl ? normalizeSourceUrl(product.sourceUrl) : null;
    for (const reference of product.termReferences ?? []) {
      const referenceUrl = reference.sourceUrl ? normalizeSourceUrl(reference.sourceUrl) : null;
      if (!referenceUrl || referenceUrl === primaryUrl || primaryUrls.has(referenceUrl)) continue;
      addSource(sources, {
        sourceName: "商品に関連する公開資料",
        title: "官能評価用語に関する資料",
        url: reference.sourceUrl,
        sourceType: "term-reference",
        reviewedAt: product.sourceReviewedAt,
      });
    }
  }
  return [...sources.values()];
}

export function setProductSourceProducts(products: ReadonlyArray<SakeProduct>): void {
  runtimeProducts = products;
}

export function setProductSourceEntries(sources: ReadonlyArray<DisplaySource>): void {
  runtimeSources = sources.filter((source) => source.category !== "terminology");
  runtimeTerminologySources = sources.filter(
    (source) => source.category === "terminology" || source.category === "shared",
  );
}

export function getProductSources(): DisplaySource[] {
  return runtimeSources ? [...runtimeSources] : collectProductSources(runtimeProducts);
}

export function getTerminologySources(): DisplaySource[] {
  return runtimeTerminologySources ? [...runtimeTerminologySources] : collectTerminologySources();
}

export const DEFAULT_TERMINOLOGY_SOURCES = collectTerminologySources();
export const DEFAULT_PRODUCT_SOURCES = collectProductSources();
