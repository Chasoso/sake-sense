import { describe, expect, it } from "vitest";
import { findSakeProductMatches } from "./sake-product-matching";

describe("Ishikawa sake product matching", () => {
  it("matches only products that reference a candidate term", () => {
    const matches = findSakeProductMatches(["kire"]);

    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.every((match) => match.product.termReferences.some((term) => term.termId === "kire")),
    ).toBe(true);
    expect(matches[0].whyShown).toContain("kire");
    expect(matches[0].matchedReferences[0].rationale).toBeTruthy();
  });

  it("preserves multiple grounded term connections without ranking", () => {
    const matches = findSakeProductMatches(["sanmi", "kire"]);
    const kashu = matches.find((match) => match.product.id === "kikuhime-kashu-kikuzake");

    expect(kashu?.matchedTermIds).toEqual(["sanmi", "kire"]);
  });

  it("returns no match when the sample has no supporting term", () => {
    expect(findSakeProductMatches(["unknown-term"])).toEqual([]);
  });
});
