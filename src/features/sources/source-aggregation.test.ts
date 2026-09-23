import { describe, expect, it } from "vitest";
import {
  collectProductSources,
  collectTerminologySources,
  isPublicEvidenceUrl,
  normalizeSourceUrl,
} from "./source-aggregation";

describe("source aggregation", () => {
  it("deduplicates terminology sources by sourceId before URL", () => {
    const sources = collectTerminologySources([
      {
        id: "one",
        displayTerm: "A",
        definitionSummary: "summary",
        vocabularyStatus: "selectable",
        sourceCategory: "test",
        everydayLanguageCandidates: [],
        provenance: [
          {
            sourceId: "shared",
            sourceName: "Shared source",
            sourceType: "glossary",
            url: "https://example.com/glossary/",
            accessedOn: "2026-01-01",
            transformationNote: "reviewed",
          },
        ],
        notes: "",
      },
      {
        id: "two",
        displayTerm: "B",
        definitionSummary: "summary",
        vocabularyStatus: "selectable",
        sourceCategory: "test",
        everydayLanguageCandidates: [],
        provenance: [
          {
            sourceId: "shared",
            sourceName: "Shared source",
            sourceType: "glossary",
            url: "https://example.com/glossary/",
            accessedOn: "2026-01-01",
            transformationNote: "reviewed",
          },
        ],
        notes: "",
      },
    ]);

    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe("https://example.com/glossary/");
  });

  it("deduplicates product sources and suppresses duplicate term references", () => {
    const products = [
      {
        sourceUrl: "https://example.com/product/",
        sourceName: "Official source",
        sourceType: "official",
        sourceReviewedAt: "2026-01-01",
        termReferences: [
          { sourceUrl: "https://example.com/product/", termId: "one" },
          { sourceUrl: "https://example.com/terms", termId: "one" },
        ],
      },
      {
        sourceUrl: "https://example.com/product",
        sourceName: "Official source",
        sourceType: "official",
        sourceReviewedAt: "2026-01-01",
        termReferences: [],
      },
    ] as never;

    const sources = collectProductSources(products);
    expect(sources.map((source) => normalizeSourceUrl(source.url))).toEqual([
      "https://example.com/product",
      "https://example.com/terms",
    ]);
  });

  it("excludes internal research URLs and tolerates malformed URLs", () => {
    expect(isPublicEvidenceUrl("https://github.com/Chasoso/sake-sense/issues/52")).toBe(false);
    expect(isPublicEvidenceUrl("https://notion.so/internal-research")).toBe(false);
    expect(normalizeSourceUrl("not a url")).toBeNull();
  });
});
