import sampleData from "./data/ishikawa-sake-sample.v0.1.json";

export type SakeProduct = (typeof sampleData.products)[number];
export type SakeTermReference = SakeProduct["termReferences"][number];

export type EvidencePresentation = {
  label: string;
  explanation: string;
};

export function presentEvidenceStatus(
  status: SakeTermReference["mappingStatus"],
): EvidencePresentation {
  if (status === "source-supported") {
    return {
      label: "\u516c\u5f0f\u8868\u73fe\u306b\u57fa\u3065\u304f\u53c2\u7167",
      explanation:
        "\u516c\u5f0f\u306e\u5546\u54c1\u8aac\u660e\u30fb\u5206\u985e\u306b\u3001\u3053\u306e\u8868\u73fe\u307e\u305f\u306f\u5bfe\u5fdc\u3059\u308b\u7528\u8a9e\u304c\u78ba\u8a8d\u3067\u304d\u307e\u3059\u3002",
    };
  }
  if (status === "inferred-from-wording") {
    return {
      label: "\u5b9f\u9a13\u7684\u306a\u8868\u73fe\u306e\u6a4b\u6e21\u3057",
      explanation:
        "\u516c\u5f0f\u304c\u3053\u306e\u7528\u8a9e\u305d\u306e\u3082\u306e\u3092\u4f7f\u3063\u3066\u3044\u308b\u3068\u306f\u9650\u308a\u307e\u305b\u3093\u3002\u8fd1\u3044\u8868\u73fe\u304b\u3089\u3001\u5b9f\u9a13\u7528\u306e\u624b\u304c\u304b\u308a\u3068\u3057\u3066\u3064\u306a\u3044\u3067\u3044\u307e\u3059\u3002",
    };
  }
  return {
    label: "\u5b9f\u9a13\u4e2d\u306e\u53c2\u7167",
    explanation:
      "\u3053\u306e\u63a5\u7d9a\u306f\u5b9f\u9a13\u7528\u306e\u4eee\u306e\u53c2\u7167\u3067\u3001\u516c\u5f0f\u306e\u7528\u8a9e\u4f7f\u7528\u3092\u793a\u3059\u3082\u306e\u3067\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
  };
}

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
