import { defineConfig } from "@playwright/test";

const demoOrigin = "http://localhost:3000";
const liveOrigin = "http://localhost:3001";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  projects: [
    {
      name: "demo",
      testMatch: "**/demo.spec.ts",
      use: { baseURL: demoOrigin },
    },
    {
      name: "live",
      testMatch: "**/live.spec.ts",
      use: {
        baseURL: liveOrigin,
        extraHTTPHeaders: { "x-vercel-ip-country": "US" },
      },
    },
  ],
  webServer: [
    {
      command: "npm run build && npm run start -- -p 3000",
      url: demoOrigin,
      env: { MIMUS_MODE: "demo" },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: "node scripts/e2e-live-server.mjs",
      url: liveOrigin,
      env: {
        MIMUS_MODE: "live",
        GEMINI_API_KEY: "e2e-placeholder",
        APP_ORIGIN: liveOrigin,
        MIMUS_LIVE_COUNTRIES: "US",
        MIMUS_DEV_ALLOW_LOCAL_LIVE: "false",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
