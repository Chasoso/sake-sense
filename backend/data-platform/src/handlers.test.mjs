import { describe, expect, it } from "vitest";
import { createMemoryRepository } from "./repository.mjs";
import { createPublicHandler } from "./public-handler.mjs";
import { createAdminHandler } from "./admin-handler.mjs";

const product = {
  id: "p1",
  name: "Published",
  status: "published",
  breweryId: "b1",
  primarySourceId: "s1",
};
const draft = { id: "p2", name: "Draft", status: "draft" };

describe("data platform handlers", () => {
  it("returns only published data and shaped details", async () => {
    const handler = createPublicHandler(
      createMemoryRepository({
        products: [product, draft],
        evidence: [{ id: "e1", productId: "p1", status: "published" }],
      }),
    );
    const list = await handler({ rawPath: "/api/products" });
    expect(JSON.parse(list.body).items).toEqual([product]);
    const detail = await handler({ rawPath: "/api/products/p2" });
    expect(detail.statusCode).toBe(404);
    const hiddenEvidence = await handler({ rawPath: "/api/products/p2/evidence" });
    expect(hiddenEvidence.statusCode).toBe(404);
  });

  it("returns a published catalog with product evidence attached", async () => {
    const handler = createPublicHandler(
      createMemoryRepository({
        products: [product, draft],
        evidence: [
          {
            id: "e1",
            productId: "p1",
            termId: "kire",
            sourceId: "s1",
            sourceWording: "exact",
            evidenceStatus: "direct",
            rationale: "reviewed",
            status: "published",
          },
          { id: "e2", productId: "p2", status: "published" },
        ],
        sources: [
          { id: "s1", sourceName: "Source", url: "https://example.com", status: "published" },
        ],
        breweries: [{ id: "b1", name: "Brewery", status: "published" }],
      }),
    );
    const response = await handler({ rawPath: "/api/catalog" });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      products: [
        {
          ...product,
          termReferences: [
            {
              id: "e1",
              productId: "p1",
              termId: "kire",
              sourceId: "s1",
              sourceWording: "exact",
              evidenceStatus: "direct",
              rationale: "reviewed",
              status: "published",
            },
          ],
        },
      ],
      sources: [
        { id: "s1", sourceName: "Source", url: "https://example.com", status: "published" },
      ],
      breweries: [{ id: "b1", name: "Brewery", status: "published" }],
    });
  });

  it("rejects unauthenticated admin access and accepts admin claims", async () => {
    const repository = createMemoryRepository({ products: [] });
    const denied = createAdminHandler(repository, async () => ({
      ok: false,
      statusCode: 401,
      message: "Unauthorized",
    }));
    expect(
      (await denied({ rawPath: "/admin/products", requestContext: { http: { method: "GET" } } }))
        .statusCode,
    ).toBe(401);
    const allowed = createAdminHandler(repository, async () => ({
      ok: true,
      claims: { sub: "admin" },
    }));
    const response = await allowed({
      rawPath: "/admin/products",
      requestContext: { http: { method: "GET" } },
    });
    expect(response.statusCode).toBe(200);
  });

  it("maps admin writes to allowlisted fields and protects referenced breweries", async () => {
    const repository = createMemoryRepository({
      breweries: [{ id: "b1", name: "Brewery", status: "published" }],
      products: [{ ...product, status: "published" }],
      sources: [
        {
          id: "s1",
          sourceName: "Source",
          url: "https://example.com",
          reviewedAt: "2026-01-01",
          status: "published",
        },
      ],
    });
    const authorize = async () => ({ ok: true, claims: { sub: "admin" } });
    const handler = createAdminHandler(repository, authorize);
    const blocked = await handler({
      rawPath: "/admin/breweries/b1",
      body: JSON.stringify({ status: "archived" }),
      requestContext: { http: { method: "PATCH" } },
    });
    expect(blocked.statusCode).toBe(409);

    const created = await handler({
      rawPath: "/admin/breweries",
      body: JSON.stringify({ name: "New", status: "draft", arbitrarySecret: "ignored" }),
      requestContext: { http: { method: "POST" } },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = JSON.parse(created.body);
    const stored = await repository.get("breweries", createdBody.id);
    expect(stored).toMatchObject({ id: createdBody.id, name: "New" });
    expect(stored.arbitrarySecret).toBeUndefined();
    const detail = await handler({
      rawPath: `/admin/breweries/${createdBody.id}`,
      requestContext: { http: { method: "GET" } },
    });
    expect(detail.statusCode).toBe(200);
    const second = await handler({
      rawPath: "/admin/breweries",
      body: JSON.stringify({ name: "Another", status: "draft" }),
      requestContext: { http: { method: "POST" } },
    });
    expect(second.statusCode).toBe(201);
    expect(JSON.parse(second.body).id).not.toBe(createdBody.id);
  });

  it("accepts published evidence only when both references are published", async () => {
    const repository = createMemoryRepository({
      products: [{ ...product, status: "published" }],
      sources: [
        {
          id: "s1",
          sourceName: "Source",
          url: "https://example.com",
          reviewedAt: "2026-01-01",
          status: "published",
        },
      ],
    });
    const handler = createAdminHandler(repository, async () => ({
      ok: true,
      claims: { sub: "admin" },
    }));
    const valid = await handler({
      rawPath: "/admin/evidence",
      body: JSON.stringify({
        productId: "p1",
        termId: "atoaji",
        sourceId: "s1",
        sourceWording: "exact",
        evidenceStatus: "direct",
        rationale: "reviewed",
        status: "published",
      }),
      requestContext: { http: { method: "POST" } },
    });
    expect(valid.statusCode).toBe(201);

    const draftProduct = createMemoryRepository({
      products: [{ ...product, status: "draft" }],
      sources: [
        {
          id: "s1",
          sourceName: "Source",
          url: "https://example.com",
          reviewedAt: "2026-01-01",
          status: "published",
        },
      ],
    });
    const rejected = await createAdminHandler(draftProduct, async () => ({
      ok: true,
      claims: { sub: "admin" },
    }))({
      rawPath: "/admin/evidence",
      body: JSON.stringify({
        productId: "p1",
        termId: "atoaji",
        sourceId: "s1",
        sourceWording: "exact",
        evidenceStatus: "direct",
        rationale: "reviewed",
        status: "published",
      }),
      requestContext: { http: { method: "POST" } },
    });
    expect(rejected.statusCode).toBe(422);
  });
});
