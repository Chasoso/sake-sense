import { describe, expect, it } from "vitest";
import dictionary from "./data/sensory-dictionary.v0.1.json";
import sample from "./data/ishikawa-sake-sample.v0.1.json";
import { findSakeSampleValidationErrors } from "./sake-sample-validation";

const termIds = new Set(dictionary.entries.map((entry) => entry.id));

describe("Ishikawa sake sample validation", () => {
  it("accepts the committed sample and valid dictionary term references", () => {
    expect(findSakeSampleValidationErrors(sample, termIds)).toEqual([]);
  });

  it("rejects duplicate products, unknown terms, and placeholder sources", () => {
    const invalid = {
      products: [
        {
          id: "same",
          sourceUrl: "https://example.com/product",
          termReferences: [{ termId: "missing" }],
          provenance: [{ url: "https://example.com/source" }],
        },
        {
          id: "same",
          sourceUrl: "https://official.example.jp/product",
          termReferences: [{ termId: "kire" }],
          provenance: [{ url: "https://official.example.jp/source" }],
        },
      ],
    };

    expect(findSakeSampleValidationErrors(invalid, termIds)).toEqual([
      "Invalid product source URL in same",
      "Unknown dictionary term missing in same",
      "Invalid provenance URL in same",
      "Duplicate sake product ID: same",
    ]);
  });
});
