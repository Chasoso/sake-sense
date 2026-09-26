import { expect, test, type Page, type Route } from "@playwright/test";

const adminSession = {
  accessToken: "e2e-admin-token",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

const product = {
  id: "product-1",
  name: "E2E Product",
  breweryId: "brewery-1",
  region: "Ishikawa",
  descriptionSummary: "A deterministic product fixture",
  availabilityStatus: "regular",
  primarySourceId: "source-1",
  status: "published",
  updatedAt: "2026-09-24T00:00:00.000Z",
};
const brewery = {
  id: "brewery-1",
  name: "E2E Brewery",
  displayName: "E2E Brewery Display",
  region: "Ishikawa",
  status: "published",
  updatedAt: "2026-09-24T00:00:00.000Z",
};
const source = {
  id: "source-1",
  sourceName: "E2E Source",
  title: "E2E Source Title",
  sourceType: "official",
  reviewedAt: "2026-09-24",
  status: "published",
  updatedAt: "2026-09-24T00:00:00.000Z",
};
const evidence = {
  id: "evidence-1",
  productId: product.id,
  termId: "nameraka",
  sourceId: source.id,
  sourceWording: "smooth and clean",
  evidenceStatus: "direct",
  rationale: "deterministic fixture",
  status: "published",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

async function authenticate(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    localStorage.setItem("sake-sense-admin-session", JSON.stringify(session));
  }, adminSession);
}

async function mockAdminApi(page: Page, handler: (route: Route) => Promise<void>): Promise<void> {
  await page.route("**/e2e-api/admin/**", handler);
}

function apiPath(route: Route): string {
  return new URL(route.request().url()).pathname.replace(/^\/e2e-api/, "");
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("Admin deterministic browser flows", () => {
  test("renders authenticated product list with required fields", async ({ page }) => {
    await authenticate(page);
    await mockAdminApi(page, async (route) => {
      if (route.request().method() === "GET" && apiPath(route) === "/admin/products")
        return fulfillJson(route, 200, { items: [product] });
      if (route.request().method() === "GET" && apiPath(route) === "/admin/breweries")
        return fulfillJson(route, 200, { items: [{ id: "brewery-1", name: "E2E Brewery" }] });
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/products");
    await expect(page.getByText("Sake Sense Admin")).toBeVisible();
    await expect(page.getByRole("link", { name: "商品" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(page.getByText("E2E Brewery")).toBeVisible();
    await expect(page.getByText("通常")).toBeVisible();
    await expect(page.getByText("公開中")).toBeVisible();
    await expect(page.getByText(product.updatedAt)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await page.getByRole("button", { name: product.name }).click();
    await expect(page.getByText(`${product.name}を編集`)).toBeVisible();
    await expect(page.getByText("基本情報")).toBeVisible();
  });

  test("creates a product with POST and a server-generated id", async ({ page }) => {
    await authenticate(page);
    let products: (typeof product)[] = [];
    let createRequest: { method: string; url: string; body: Record<string, string> } | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/products" && request.method() === "GET")
        return fulfillJson(route, 200, { items: products });
      if (pathname === "/admin/breweries" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [{ id: "brewery-1", name: "E2E Brewery" }] });
      if (pathname === "/admin/sources" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [{ id: "source-1", sourceName: "E2E Source" }] });
      if (pathname === "/admin/products" && request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, string>;
        createRequest = { method: request.method(), url: request.url(), body };
        products = [{ ...product, ...body, id: "server-product-1" }];
        return fulfillJson(route, 201, products[0]);
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/products");
    await page.getByRole("button", { name: "Create new record" }).click();
    await page.getByLabel("name", { exact: true }).fill("Created product");
    await page.getByLabel("breweryId", { exact: true }).selectOption("brewery-1");
    await page.getByLabel("region", { exact: true }).fill("Ishikawa");
    await page.getByLabel("descriptionSummary", { exact: true }).fill("Created in E2E");
    await page.getByLabel("availabilityStatus", { exact: true }).selectOption("regular");
    await page.getByLabel("primarySourceId", { exact: true }).selectOption("source-1");
    await page.getByLabel("status", { exact: true }).selectOption("draft");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => createRequest?.method).toBe("POST");
    expect(createRequest?.url).toMatch(/\/admin\/products$/);
    expect(createRequest?.url).not.toContain("/new");
    expect(createRequest?.body).toMatchObject({ name: "Created product", breweryId: "brewery-1" });
    await expect(page.getByText("Created product")).toBeVisible();
  });

  test("loads and edits a product from a direct detail route", async ({ page }) => {
    await authenticate(page);
    let patchBody: Record<string, string> | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/products" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [product] });
      if (pathname === "/admin/products/product-1" && request.method() === "GET")
        return fulfillJson(route, 200, product);
      if (pathname === "/admin/products/product-1" && request.method() === "PATCH") {
        patchBody = request.postDataJSON() as Record<string, string>;
        return fulfillJson(route, 200, { ...product, ...patchBody });
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/products/product-1");
    const name = page.getByLabel("name", { exact: true });
    await expect(name).toHaveValue(product.name);
    await name.fill("Edited product");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => patchBody?.name).toBe("Edited product");
    expect(patchBody).toMatchObject({ id: product.id, name: "Edited product" });
  });

  test("shows login without a session and an API error with an authenticated session", async ({
    page,
  }) => {
    await page.goto("/admin/products");
    await expect(page.getByRole("button", { name: /Cognito/ })).toBeVisible();

    await authenticate(page);
    await page.goto("about:blank");
    await page.route("**/e2e-api/admin/products", (route) =>
      fulfillJson(route, 500, { error: "internal_error" }),
    );
    await page.goto("/admin/products");
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("updates React session state after a mocked Cognito callback", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        "sake-sense-admin-pkce",
        JSON.stringify({ state: "e2e-state", verifier: "e2e-verifier" }),
      );
    });
    await page.route("https://cognito.example.test/oauth2/token", (route) =>
      fulfillJson(route, 200, { access_token: "callback-token", expires_in: 3600 }),
    );
    await mockAdminApi(page, async (route) => {
      if (route.request().method() === "GET" && apiPath(route) === "/admin/products")
        return fulfillJson(route, 200, { items: [product] });
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/callback?code=e2e-code&state=e2e-state");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Sake Sense Admin")).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
  });

  test("keeps the product editor usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await authenticate(page);
    await mockAdminApi(page, async (route) => {
      const pathname = apiPath(route);
      if (pathname === "/admin/products" && route.request().method() === "GET")
        return fulfillJson(route, 200, { items: [] });
      return fulfillJson(route, 404, { error: "not_found" });
    });
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "Create new record" }).click();
    await expect(page.getByLabel("name", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save record" })).toBeVisible();
  });

  test("renders breweries as a table and opens the sectioned editor", async ({ page }) => {
    await authenticate(page);
    await mockAdminApi(page, async (route) => {
      if (route.request().method() === "GET" && apiPath(route) === "/admin/breweries")
        return fulfillJson(route, 200, { items: [brewery] });
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/breweries");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("button", { name: brewery.name, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: brewery.displayName, exact: true })).toBeVisible();
    await page.getByRole("button", { name: brewery.name }).click();
    await expect(page.getByLabel("officialUrl", { exact: true })).toBeVisible();
    await expect(page.getByLabel("status", { exact: true })).toHaveValue("published");
  });

  test("renders sources as a table and opens the sectioned editor", async ({ page }) => {
    await authenticate(page);
    await mockAdminApi(page, async (route) => {
      if (route.request().method() === "GET" && apiPath(route) === "/admin/sources")
        return fulfillJson(route, 200, { items: [source] });
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/sources");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("button", { name: source.sourceName, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: source.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: source.sourceName }).click();
    await expect(page.getByLabel("url", { exact: true })).toBeVisible();
    await expect(page.getByLabel("status", { exact: true })).toHaveValue("published");
  });

  test("creates and edits a brewery with the existing API shape", async ({ page }) => {
    await authenticate(page);
    let items: Record<string, unknown>[] = [];
    let postBody: Record<string, unknown> | null = null;
    let patchBody: Record<string, unknown> | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/breweries" && request.method() === "GET")
        return fulfillJson(route, 200, { items });
      if (pathname === "/admin/breweries" && request.method() === "POST") {
        postBody = request.postDataJSON() as Record<string, unknown>;
        items = [{ id: "created-brewery", ...postBody }];
        return fulfillJson(route, 201, items[0]);
      }
      if (pathname === "/admin/breweries/created-brewery" && request.method() === "PATCH") {
        patchBody = request.postDataJSON() as Record<string, unknown>;
        return fulfillJson(route, 200, { id: "created-brewery", ...patchBody });
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });
    await page.goto("/admin/breweries");
    await page.getByRole("button", { name: "Create new record" }).click();
    await page.getByLabel("name", { exact: true }).fill("Created Brewery");
    await page.getByLabel("displayName", { exact: true }).fill("Created Brewery Display");
    await page.getByLabel("region", { exact: true }).fill("Ishikawa");
    await page.getByLabel("officialUrl", { exact: true }).fill("https://example.test/brewery");
    await page.getByLabel("status", { exact: true }).selectOption("draft");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => postBody?.name).toBe("Created Brewery");
    expect(postBody).not.toHaveProperty("id", "new");
    const displayNameField = page.getByLabel("displayName", { exact: true });
    await expect(displayNameField).toHaveValue("Created Brewery Display");
    await displayNameField.fill("Edited Brewery Display");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => patchBody?.displayName).toBe("Edited Brewery Display");
  });

  test("creates and edits a source while preserving its payload fields", async ({ page }) => {
    await authenticate(page);
    let items: Record<string, unknown>[] = [];
    let postBody: Record<string, unknown> | null = null;
    let patchBody: Record<string, unknown> | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/sources" && request.method() === "GET")
        return fulfillJson(route, 200, { items });
      if (pathname === "/admin/sources" && request.method() === "POST") {
        postBody = request.postDataJSON() as Record<string, unknown>;
        items = [{ id: "created-source", ...postBody }];
        return fulfillJson(route, 201, items[0]);
      }
      if (pathname === "/admin/sources/created-source" && request.method() === "PATCH") {
        patchBody = request.postDataJSON() as Record<string, unknown>;
        return fulfillJson(route, 200, { id: "created-source", ...patchBody });
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });
    await page.goto("/admin/sources");
    await page.getByRole("button", { name: "Create new record" }).click();
    await page.getByLabel("sourceName", { exact: true }).fill("Created Source");
    await page.getByLabel("title", { exact: true }).fill("Created Source Title");
    await page.getByLabel("url", { exact: true }).fill("https://example.test/source");
    await page.getByLabel("sourceType", { exact: true }).fill("official");
    await page.getByLabel("reviewedAt", { exact: true }).fill("2026-09-24");
    await page.getByLabel("status", { exact: true }).selectOption("draft");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => postBody?.sourceName).toBe("Created Source");
    await page.getByLabel("title", { exact: true }).fill("Edited Source Title");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => patchBody?.title).toBe("Edited Source Title");
  });

  test("creates evidence with readable relations and preserves relation IDs", async ({ page }) => {
    await authenticate(page);
    let items: Record<string, unknown>[] = [];
    let postBody: Record<string, unknown> | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/evidence" && request.method() === "GET")
        return fulfillJson(route, 200, { items });
      if (pathname === "/admin/products" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [product] });
      if (pathname === "/admin/sources" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [source] });
      if (pathname === "/admin/evidence" && request.method() === "POST") {
        postBody = request.postDataJSON() as Record<string, unknown>;
        items = [{ id: "created-evidence", ...postBody }];
        return fulfillJson(route, 201, items[0]);
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });
    await page.goto("/admin/evidence");
    await page.getByRole("button", { name: "Create new record" }).click();
    await page.getByLabel("productId", { exact: true }).selectOption(product.id);
    await page.getByLabel("termId", { exact: true }).fill("nameraka");
    await page.getByLabel("sourceId", { exact: true }).selectOption(source.id);
    await page.getByLabel("sourceWording", { exact: true }).fill("smooth and clean");
    await page.getByLabel("evidenceStatus", { exact: true }).selectOption("direct");
    await page.getByLabel("rationale", { exact: true }).fill("deterministic fixture");
    await page.getByLabel("status", { exact: true }).selectOption("draft");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => postBody?.productId).toBe(product.id);
    expect(postBody).toMatchObject({ sourceId: source.id, termId: "nameraka" });
    expect(postBody).not.toHaveProperty("productId", product.name);
  });

  test("resolves evidence relations and preserves IDs in the edit payload", async ({ page }) => {
    await authenticate(page);
    let patchBody: Record<string, unknown> | null = null;
    await mockAdminApi(page, async (route) => {
      const request = route.request();
      const pathname = apiPath(route);
      if (pathname === "/admin/evidence" && request.method() === "GET")
        return fulfillJson(route, 200, {
          items: [evidence, { ...evidence, id: "evidence-2", productId: "missing-product" }],
        });
      if (pathname === "/admin/products" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [product] });
      if (pathname === "/admin/sources" && request.method() === "GET")
        return fulfillJson(route, 200, { items: [source] });
      if (pathname === "/admin/evidence/evidence-1" && request.method() === "PATCH") {
        patchBody = request.postDataJSON() as Record<string, unknown>;
        return fulfillJson(route, 200, { ...evidence, ...patchBody });
      }
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/evidence");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(
      page.getByRole("cell", { name: source.sourceName, exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("missing-product", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: product.name }).click();
    await page.getByLabel("productId", { exact: true }).selectOption(product.id);
    await page.getByLabel("sourceId", { exact: true }).selectOption(source.id);
    await page.getByRole("button", { name: "Save record" }).click();
    await expect.poll(() => patchBody?.productId).toBe(product.id);
    expect(patchBody).toMatchObject({ sourceId: source.id, termId: evidence.termId });
  });
});
