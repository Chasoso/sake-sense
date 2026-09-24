import { describe, expect, it } from "vitest";
import breweries from "../src/domain/data/ishikawa-breweries.v0.1.json";
import products from "../src/domain/data/ishikawa-sake-sample.v0.1.json";
import dictionary from "../src/domain/data/sensory-dictionary.v0.1.json";
import {
  migrateCuratedData,
  validateMigrationResult,
} from "../backend/data-platform/src/migration.mjs";

describe("curated sake migration", () => {
  it("maps stable entities, deduplicates sources, and preserves evidence", () => {
    const first = migrateCuratedData({ breweries, products, dictionary });
    const second = migrateCuratedData({ breweries, products, dictionary });
    expect(first.breweries).toHaveLength(32);
    expect(first.products).toHaveLength(products.products.length);
    expect(first.sources.length).toBeLessThan(
      products.products.length + breweries.memberBreweries.length,
    );
    expect(first.evidence.length).toBeGreaterThan(0);
    expect(first.report.invalidCount).toBe(0);
    expect(first.breweries.map((item) => item.id)).toEqual(second.breweries.map((item) => item.id));
    expect(first.evidence.map((item) => item.id)).toEqual(second.evidence.map((item) => item.id));
    expect(validateMigrationResult(first)).toEqual([]);
  });

  it("reports invalid references instead of silently dropping them", () => {
    const result = migrateCuratedData({
      breweries: { memberBreweries: [] },
      products: { products: [{ id: "bad", breweryId: "missing", sourceUrl: "not-url" }] },
      dictionary,
    });
    expect(result.report.invalidCount).toBeGreaterThan(0);
  });
});
