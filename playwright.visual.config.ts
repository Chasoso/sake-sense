import { defineConfig } from "@playwright/test";
import adminConfig from "./playwright.admin.config";

export default defineConfig({
  ...adminConfig,
  snapshotPathTemplate: "{testDir}/admin-visual-snapshots/{arg}{ext}",
});
