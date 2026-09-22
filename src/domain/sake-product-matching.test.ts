import { describe, expect, it } from "vitest";
import { findSakeProductMatches, presentEvidenceStatus } from "./sake-product-matching";

describe("Ishikawa sake product matching", () => {
  it("matches only selectable terms through explicit renderable evidence", () => {
    const matches = findSakeProductMatches(["kire"]);
    expect(matches.length).toBeGreaterThan(0);
    expect(
      matches.every((match) =>
        match.matchedReferences.every((reference) => reference.termId === "kire"),
      ),
    ).toBe(true);
    expect(matches.some((match) => match.product.id === "kagatobi-ikazuchi-issen")).toBe(true);
    expect(matches.every((match) => match.product.availabilityStatus !== "unknown")).toBe(true);
  });

  it("keeps unconfirmed seasonal variants as provenance-backed references", () => {
    const marui = findSakeProductMatches(["marui"]);
    expect(marui.map((match) => match.product.id)).not.toContain("kikuhime-junmai-hiyaoroshi");
    expect(marui.some((match) => match.product.id === "mujou-junmai-hiyaoroshi")).toBe(false);
    expect(findSakeProductMatches(["sanmi", "nojun", "umami"])).toEqual([]);
  });

  it("keeps newly selectable tanrei and nojun safe when product evidence is absent or not renderable", () => {
    expect(findSakeProductMatches(["tanrei"])).toEqual([]);
    expect(findSakeProductMatches(["nojun"])).toEqual([]);
  });

  it("does not use free text, weak evidence, or unavailable products as matches", () => {
    expect(findSakeProductMatches(["unknown-term"])).toEqual([]);
    const atoaji = findSakeProductMatches(["atoaji"]);
    expect(atoaji.some((match) => match.product.id === "kaganotsuki-junmai-ginjo")).toBe(false);
    expect(atoaji.some((match) => match.product.id === "kuromatsu-wakawaka")).toBe(false);
  });

  it("presents evidence policy without treating internal strength as taste truth", () => {
    expect(presentEvidenceStatus("direct").label).toBe("出典の明示表現");
    expect(presentEvidenceStatus("accepted-variant").label).toBe("承認済み表記variant");
    expect(presentEvidenceStatus("weak").explanation).toContain(
      "通常のproduct matchには使いません",
    );
    expect(presentEvidenceStatus("rejected").explanation).toContain(
      "通常のproduct matchには使いません",
    );
  });
});
