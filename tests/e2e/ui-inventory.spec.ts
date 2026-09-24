import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const inventoryRoot = path.resolve(process.cwd(), "docs/ui-inventory/screenshots");
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
} as const;

const screens = [
  ["01-start", "start"],
  ["02-body-loading", "body-loading"],
  ["03-body-ready", "body-ready"],
  ["04-body-countdown", "body-countdown"],
  ["05-body-capturing", "body-capturing"],
  ["06-body-replay", "body-replay"],
  ["07-body-result", "body-result"],
  ["08-body-no-match", "body-no-match"],
  ["09-body-denied", "body-denied"],
  ["10-voice-initial", "voice-initial"],
  ["11-voice-recording", "voice-recording"],
  ["12-voice-analyzing", "voice-analyzing"],
  ["13-voice-result", "voice-result"],
  ["14-voice-no-match", "voice-no-match"],
  ["15-gesture-initial", "gesture-initial"],
  ["16-gesture-drawing", "gesture-drawing"],
  ["17-gesture-result", "gesture-result"],
  ["18-sources", "sources"],
] as const;

test.describe.configure({ mode: "serial" });

for (const [device, viewport] of Object.entries(viewports)) {
  test(`captures ${device} UI inventory`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const outputDirectory = path.join(inventoryRoot, device);
    fs.mkdirSync(outputDirectory, { recursive: true });

    for (const [fileStem, state] of screens) {
      const url = state === "start" ? "/" : `/?uiInventory=${state}`;
      await page.goto(url);
      if (state === "start") {
        await expect(page.locator('[data-mode="body"]')).toBeVisible();
      } else {
        await expect(page.locator(`[data-ui-inventory-state="${state}"]`)).toBeVisible();
        await expect(page.locator('[data-ui-inventory-ready="true"]')).toBeVisible();
      }
      await page.screenshot({
        path: path.join(outputDirectory, `${fileStem}.png`),
        fullPage: true,
      });
    }
  });
}
