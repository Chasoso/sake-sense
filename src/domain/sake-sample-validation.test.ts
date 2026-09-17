import { describe, expect, it } from "vitest";
import breweries from "./data/ishikawa-breweries.v0.1.json";
import dictionary from "./data/sensory-dictionary.v0.1.json";
import sample from "./data/ishikawa-sake-sample.v0.1.json";
import {
  findSakeSampleValidationErrors,
  isNormalImageRenderable,
  isRenderableProductTermReference,
} from "./sake-sample-validation";

describe("Ishikawa sake MVP dataset validation", () => {
  it("covers exactly the reviewed 32-member brewery baseline", () => {
    expect(breweries.memberBreweries).toHaveLength(32);
    expect(new Set(breweries.memberBreweries.map((brewery) => brewery.id)).size).toBe(32);
    expect(new Set(sample.products.map((product) => product.breweryId))).toEqual(
      new Set(breweries.memberBreweries.map((brewery) => brewery.id)),
    );
    expect(findSakeSampleValidationErrors(sample, dictionary.entries, breweries)).toEqual([]);
  });

  it("keeps availability, image permission, and evidence policy separate", () => {
    const directRegular = sample.products.find(
      (product) => product.id === "kagatobi-ikazuchi-issen",
    )!;
    const unknown = sample.products.find((product) => product.id === "kaganotsuki-junmai-ginjo")!;
    const seasonal = sample.products.find(
      (product) => product.id === "kikuhime-junmai-hiyaoroshi",
    )!;
    const rejected = sample.products.find((product) => product.id === "mujou-junmai-hiyaoroshi")!;
    const dictionaryById = new Map(dictionary.entries.map((entry) => [entry.id, entry]));

    expect(
      isRenderableProductTermReference(
        directRegular.termReferences[0],
        directRegular,
        dictionaryById,
      ),
    ).toBe(true);
    expect(
      isRenderableProductTermReference(seasonal.termReferences[0], seasonal, dictionaryById),
    ).toBe(false);
    expect(
      isRenderableProductTermReference(
        seasonal.termReferences[0],
        { ...seasonal, currentAvailabilityStatus: "confirmed" },
        dictionaryById,
      ),
    ).toBe(true);
    expect(
      isRenderableProductTermReference(
        directRegular.termReferences[0],
        { ...directRegular, availabilityStatus: "discontinued" },
        dictionaryById,
      ),
    ).toBe(false);
    expect(
      isRenderableProductTermReference(unknown.termReferences[0], unknown, dictionaryById),
    ).toBe(false);
    expect(
      isRenderableProductTermReference(rejected.termReferences[0], rejected, dictionaryById),
    ).toBe(false);
    expect(isNormalImageRenderable(directRegular)).toBe(false);
    expect(
      isNormalImageRenderable({
        imageUsageStatus: "allowed",
        imageSourceUrl: "https://official.example.jp/image.jpg",
      }),
    ).toBe(true);
    expect(isNormalImageRenderable({ imageUsageStatus: "allowed" })).toBe(false);
    expect(
      isNormalImageRenderable({
        imageUsageStatus: "needs-review",
        imageSourceUrl: "https://official.example.jp/image.jpg",
      }),
    ).toBe(false);
    expect(isNormalImageRenderable({ imageUsageStatus: "not-allowed" })).toBe(false);
  });

  it("rejects invalid product links, unsafe evidence, and incomplete coverage", () => {
    const invalid = structuredClone(sample);
    invalid.products[0].id = invalid.products[1].id;
    invalid.products[0].breweryId = "missing";
    invalid.products[0].sourceUrl = "https://example.com/product";
    invalid.products[0].imageSourcePageUrl = "https://example.com/image";
    invalid.products[0].availabilityStatus = "seasonal";
    invalid.products[0].termReferences = [
      {
        termId: "marui",
        sourceWording: "まろやか",
        evidenceStatus: "direct",
        rationale: "invalid",
        sourceUrl: "https://example.com/evidence",
      },
    ];
    invalid.products = invalid.products.filter((product) => product.breweryId !== "matsunami");

    expect(findSakeSampleValidationErrors(invalid, dictionary.entries, breweries)).toEqual(
      expect.arrayContaining([
        `Duplicate sake product ID: ${sample.products[1].id}`,
        `Unknown brewery missing in ${sample.products[1].id}`,
        `Invalid product source URL in ${sample.products[1].id}`,
        `Invalid image source page URL in ${sample.products[1].id}`,
        `Missing current availability status for seasonal product ${sample.products[1].id}`,
        `Rejected wording まろやか cannot support marui in ${sample.products[1].id}`,
        "Missing researched product for brewery matsunami",
      ]),
    );
  });

  it("rejects duplicate or unsupported brewery coverage records", () => {
    const invalidBaseline = structuredClone(breweries);
    invalidBaseline.memberBreweries.push({
      ...invalidBaseline.memberBreweries[0],
      coverageStatus: "unsupported",
      coverageSourceUrl: "https://example.com/source",
    });
    expect(findSakeSampleValidationErrors(sample, dictionary.entries, invalidBaseline)).toEqual(
      expect.arrayContaining([
        "Expected 32 member breweries, got 33",
        "Duplicate brewery ID: kuse",
        "Missing coverage provenance for brewery kuse",
        "Invalid brewery coverage status: kuse",
      ]),
    );
  });
});
