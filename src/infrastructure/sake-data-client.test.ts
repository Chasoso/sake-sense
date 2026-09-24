import { describe, expect, it } from "vitest";
import { createApiSakeDataClient } from "./sake-data-client";

describe("sake data API client", () => {
  it("loads the complete catalog with one public API request", async () => {
    const requests: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const body = {
        products: [
          {
            id: "p1",
            name: "Product",
            status: "published",
            termReferences: [
              {
                productId: "p1",
                termId: "kire",
                sourceWording: "exact",
                evidenceStatus: "direct",
                rationale: "reviewed",
                status: "published",
              },
            ],
          },
        ],
        sources: [
          {
            id: "s1",
            sourceName: "Source",
            url: "https://example.com/source",
            reviewedAt: "2026-01-01",
          },
        ],
        breweries: [{ id: "b1", name: "Brewery", status: "published" }],
      };
      return { ok: true, json: async () => body } as Response;
    };
    const client = createApiSakeDataClient("https://api.example.test", fetcher);
    const catalog = await client.loadCatalog();
    expect(catalog.products[0].termReferences[0].sourceWording).toBe("exact");
    expect(catalog.sources[0].url).toBe("https://example.com/source");
    expect(catalog.breweries[0].name).toBe("Brewery");
    expect(requests).toEqual(["https://api.example.test/api/catalog"]);
  });
});
