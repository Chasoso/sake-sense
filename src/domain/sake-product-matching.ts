import sampleData from "./data/ishikawa-sake-sample.v0.1.json";

export type SakeProduct = (typeof sampleData.products)[number];
export type SakeTermReference = SakeProduct["termReferences"][number];

export type SakeProductMatch = {
  product: SakeProduct;
  matchedTermIds: string[];
  matchedReferences: SakeTermReference[];
  whyShown: string;
};

/**
 * Match dictionary candidates to the small, provenance-backed sample only.
 * This is an example connection for the experiment, not a recommendation.
 */
export function findSakeProductMatches(
  candidateTermIds: ReadonlyArray<string>,
): SakeProductMatch[] {
  const candidateIds = new Set(candidateTermIds);

  return sampleData.products.flatMap((product) => {
    const matchedReferences = product.termReferences.filter((reference) =>
      candidateIds.has(reference.termId),
    );
    if (!matchedReferences.length) return [];
    const matchedTermIds = matchedReferences.map((reference) => reference.termId);

    return [
      {
        product,
        matchedTermIds,
        matchedReferences,
        whyShown: `この商品には ${matchedTermIds.join(", ")} の参照があります。`,
      },
    ];
  });
}
