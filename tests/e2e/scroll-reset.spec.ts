import { expect, test } from "@playwright/test";

async function makePageScrollable(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    document.documentElement.style.minHeight = "1600px";
    document.body.style.minHeight = "1600px";
  });
}

test("resets scroll when navigating from Start to Sources", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await makePageScrollable(page);
  await page.evaluate(() => window.scrollTo({ top: 500, left: 0, behavior: "auto" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.locator('[data-mode="sources"]').click();
  await expect(page.locator(".sources-page")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});

test("resets scroll when Gesture input transitions to Result", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('[data-mode="gesture"]').click();
  await makePageScrollable(page);

  const pad = page.locator("svg.gesture-pad");
  const box = await pad.boundingBox();
  if (!box) throw new Error("gesture pad has no layout box");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.up();
  await expect(page.locator(".gesture-actions .button--primary")).toBeEnabled();

  await page.evaluate(() => window.scrollTo({ top: 500, left: 0, behavior: "auto" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.locator(".gesture-actions .button--primary").click();

  await expect(page.locator('main[aria-labelledby="result-title"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});
