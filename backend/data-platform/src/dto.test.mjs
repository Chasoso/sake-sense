import { describe, expect, it } from "vitest";
import { toPublicBrewery, toPublicEvidence, toPublicProduct, toPublicSource } from "./dto.mjs";

describe("public DTO allowlists", () => {
  it("keeps contract fields and excludes internal fields", () => {
    const item = {
      id: "p1",
      name: "Product",
      breweryId: "b1",
      status: "published",
      sourceUrl: "https://example.com",
      audit: { updatedBy: "admin" },
      createdAt: "internal",
      updatedAt: "internal",
      internalNote: "must not leak",
    };
    const dto = toPublicProduct(item);
    expect(dto).toMatchObject({ id: "p1", name: "Product", sourceUrl: "https://example.com" });
    expect(dto).not.toHaveProperty("audit");
    expect(dto).not.toHaveProperty("internalNote");
  });

  it("uses explicit allowlists for every public resource", () => {
    expect(toPublicBrewery({ id: "b", name: "B", internal: true })).toEqual({ id: "b", name: "B" });
    expect(toPublicSource({ id: "s", sourceName: "S", internal: true })).toEqual({
      id: "s",
      sourceName: "S",
    });
    expect(
      toPublicEvidence({ id: "e", productId: "p", sourceWording: "exact", internal: true }),
    ).toEqual({ id: "e", productId: "p", sourceWording: "exact" });
  });
});
