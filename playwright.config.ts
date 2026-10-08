import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:1421",
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 1421",
    url: "http://127.0.0.1:1421",
    reuseExistingServer: false,
    timeout: 90000,
  },
  outputDir: "artifacts/browser",
});
