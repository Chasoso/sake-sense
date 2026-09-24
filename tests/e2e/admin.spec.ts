import { expect, test, type Page, type Route } from "@playwright/test";

const adminSession = {
  accessToken: "e2e-admin-token",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

const product = {
  id: "product-1",
  name: "E2E Product",
  breweryName: "E2E Brewery",
  breweryId: "brewery-1",
  region: "Ishikawa",
  descriptionSummary: "A deterministic product fixture",
  availabilityStatus: "available",
  primarySourceId: "source-1",
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
      return fulfillJson(route, 404, { error: "not_found" });
    });

    await page.goto("/admin/products");
    await expect(page.getByText("Sake Sense Admin")).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await expect(page.getByText(product.breweryName)).toBeVisible();
    await expect(page.getByText(product.availabilityStatus)).toBeVisible();
    await expect(page.getByText(product.status)).toBeVisible();
    await expect(page.getByText(product.updatedAt)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
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
    for (const [field, value] of Object.entries({
      name: "Created product",
      breweryId: "brewery-1",
      region: "Ishikawa",
      descriptionSummary: "Created in E2E",
      availabilityStatus: "available",
      primarySourceId: "source-1",
      status: "draft",
    })) {
      await page.getByLabel(field, { exact: true }).fill(value);
    }
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
});
