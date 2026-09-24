import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  webServer: {
    ...baseConfig.webServer,
    env: {
      ...baseConfig.webServer?.env,
      VITE_SAKE_DATA_API_BASE_URL: "http://127.0.0.1:4173/e2e-api",
      VITE_COGNITO_DOMAIN: "https://cognito.example.test",
      VITE_COGNITO_CLIENT_ID: "e2e-client",
    },
  },
});
