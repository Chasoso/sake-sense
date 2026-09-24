import { describe, expect, it } from "vitest";
import { createApiSakeDataClient } from "./sake-data-client";

describe("sake data API client", () => {
  it("hydrates product evidence through the public contract without exposing DynamoDB shape", async () => {
    const requests: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const body = url.endsWith("/api/products")
        ? { items: [{ id: "p1", name: "Product", status: "published", termReferences: [] }] }
        : url.endsWith("/evidence")
          ? {
              items: [
                {
                  productId: "p1",
                  termId: "kire",
                  sourceId: "s1",
                  sourceWording: "exact",
                  evidenceStatus: "direct",
                  rationale: "reviewed",
                  status: "published",
                },
              ],
            }
          : url.endsWith("/api/breweries")
            ? { items: [{ id: "b1", name: "Brewery", status: "published" }] }
            : {
                items: [
                  {
                    id: "s1",
                    sourceName: "Source",
                    url: "https://example.com/source",
                    reviewedAt: "2026-01-01",
                  },
                ],
              };
      return { ok: true, json: async () => body } as Response;
    };
    const client = createApiSakeDataClient("https://api.example.test", fetcher);
    const products = await client.loadProducts();
    const sources = await client.loadSources();
    const breweries = await client.loadBreweries();
    expect(products[0].termReferences[0].sourceWording).toBe("exact");
    expect(sources[0].url).toBe("https://example.com/source");
    expect(requests).toEqual([
      "https://api.example.test/api/products",
      "https://api.example.test/api/products/p1/evidence",
      "https://api.example.test/api/sources",
      "https://api.example.test/api/breweries",
    ]);
    expect(breweries[0].name).toBe("Brewery");
  });
});
