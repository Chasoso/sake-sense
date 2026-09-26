import { expect, test } from "@playwright/test";

const session = { accessToken: "visual-token", expiresAt: Date.now() + 3_600_000 };
const product = {
  id: "visual-product",
  name: "菊鶴",
  breweryId: "visual-brewery",
  region: "Ishikawa",
  descriptionSummary: "Visual regression fixture",
  availabilityStatus: "regular",
  primarySourceId: "visual-source",
  status: "published",
  updatedAt: "2026-09-24T00:00:00.000Z",
};
const screenshotOptions = {
  fullPage: true,
  maxDiffPixelRatio: 0.01,
  threshold: 0.35,
} as const;

async function setup(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((value) => {
    localStorage.setItem("sake-sense-admin-session", JSON.stringify(value));
  }, session);
  await page.route("**/e2e-api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/e2e-api", "");
    const body =
      path === "/admin/products"
        ? { items: [product] }
        : path === "/admin/breweries"
          ? { items: [{ id: "visual-brewery", name: "手取酒造", displayName: "手取酒造" }] }
          : path === "/admin/sources"
            ? { items: [{ id: "visual-source", sourceName: "公式資料", title: "商品ページ" }] }
            : { items: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("admin products desktop visual reference", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/products");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page).toHaveScreenshot("admin-products-desktop.png", screenshotOptions);
});

test("admin breweries mobile visual reference", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/breweries");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page).toHaveScreenshot("admin-breweries-mobile.png", screenshotOptions);
});

test("admin evidence shared UI visual reference", async ({ page }) => {
  await setup(page);
  await page.goto("/admin/evidence");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page).toHaveScreenshot("admin-evidence-desktop.png", screenshotOptions);
});
