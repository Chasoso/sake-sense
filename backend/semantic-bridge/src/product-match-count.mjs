import dictionaryData from "../../../src/domain/data/sensory-dictionary.v0.1.json" with { type: "json" };
import sampleData from "../../../src/domain/data/ishikawa-sake-sample.v0.1.json" with { type: "json" };

const selectableTermIds = new Set(
  dictionaryData.entries
    .filter((entry) => entry.vocabularyStatus === "selectable")
    .map((entry) => entry.id),
);

function isRenderableReference(reference, product) {
  return (
    selectableTermIds.has(reference.termId) &&
    (reference.evidenceStatus === "direct" || reference.evidenceStatus === "accepted-variant") &&
    (product.availabilityStatus === "regular" ||
      (product.availabilityStatus === "seasonal" &&
        product.currentAvailabilityStatus === "confirmed")) &&
    Boolean(product.provenanceNotes) &&
    Boolean(reference.sourceWording) &&
    Boolean(reference.rationale) &&
    Boolean(reference.sourceUrl)
  );
}

/**
 * Count products using the same explicit evidence/provenance/availability
 * boundary as the domain product matcher. This is count-only diagnostics; it
 * does not expose product identifiers or authorize terms.
 */
export function countRenderableProductMatches(candidateTermIds) {
  const candidateIds = new Set(
    Array.isArray(candidateTermIds) ? candidateTermIds.filter((id) => typeof id === "string") : [],
  );
  return sampleData.products.filter((product) =>
    product.termReferences.some(
      (reference) =>
        candidateIds.has(reference.termId) && isRenderableReference(reference, product),
    ),
  ).length;
}
