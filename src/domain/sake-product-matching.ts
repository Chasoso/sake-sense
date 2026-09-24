import dictionaryData from "./data/sensory-dictionary.v0.1.json";
import { getSakeProducts, type RuntimeSakeProduct } from "./sake-catalog";
import { isRenderableProductTermReference } from "./sake-sample-validation";

export type SakeProduct = RuntimeSakeProduct;
export type SakeTermReference = SakeProduct["termReferences"][number];

const dictionary = new Map(dictionaryData.entries.map((entry) => [entry.id, entry]));

export type EvidencePresentation = { label: string; explanation: string };

export function presentEvidenceStatus(
  status: SakeTermReference["evidenceStatus"],
): EvidencePresentation {
  if (status === "direct")
    return {
      label: "出典の明示表現",
      explanation: "出典がこの語または直接的な表記を明示しています。",
    };
  if (status === "accepted-variant")
    return {
      label: "承認済み表記variant",
      explanation: "人間レビュー済みの限定的な表記variantです。",
    };
  if (status === "weak")
    return { label: "参照用の弱い根拠", explanation: "通常のproduct matchには使いません。" };
  return {
    label: "採用しない表記",
    explanation: "監査のため保持しますが、通常のproduct matchには使いません。",
  };
}

export type SakeProductMatch = {
  product: SakeProduct;
  matchedTermIds: string[];
  matchedReferences: SakeTermReference[];
  whyShown: string;
};

/**
 * Uses only explicit structured term evidence. It does not inspect free text,
 * infer taste terms, or return reference-only / unavailable products.
 */
export function findSakeProductMatches(
  candidateTermIds: ReadonlyArray<string>,
): SakeProductMatch[] {
  const candidateIds = new Set(
    candidateTermIds.filter((id) => dictionary.get(id)?.vocabularyStatus === "selectable"),
  );

  return getSakeProducts().flatMap((product) => {
    const matchedReferences = product.termReferences.filter(
      (reference) =>
        candidateIds.has(reference.termId) &&
        isRenderableProductTermReference(reference, product, dictionary),
    );
    if (!matchedReferences.length) return [];
    const matchedTermIds = matchedReferences.map((reference) => reference.termId);
    return [
      {
        product,
        matchedTermIds,
        matchedReferences,
        whyShown: `この商品には ${matchedTermIds.join(", ")} の明示的な出典根拠があります。`,
      },
    ];
  });
}
