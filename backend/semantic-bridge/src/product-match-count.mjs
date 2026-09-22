import { findSakeProductMatches } from "../../../src/domain/sake-product-matching.ts";

/**
 * Return only the count from the production matcher. The diagnostic path uses
 * the same matcher as the UI and never exposes product identifiers.
 */
export function countRenderableProductMatches(candidateTermIds) {
  return findSakeProductMatches(
    Array.isArray(candidateTermIds)
      ? candidateTermIds.filter((termId) => typeof termId === "string")
      : [],
  ).length;
}
