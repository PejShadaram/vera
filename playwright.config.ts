import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

export const AUTH_FILE = path.join(__dirname, ".playwright/auth.json");

export default defineConfig({
  testDir:  "./tests/e2e",
  timeout:  90_000,
  retries:  1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL:           process.env.BASE_URL ?? "http://localhost:3000",
    trace:             "on-first-retry",
    screenshot:        "only-on-failure",
    headless:          true,
  },

  projects: [
    // Login once + pre-auth all test users — needs more time
    {
      name:    "setup",
      testMatch: "**/auth.setup.ts",
      timeout:   300_000, // 5 min — logs in 5 users sequentially
    },
    // All other tests reuse saved session
    {
      name:         "chromium",
      use:          { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
  ],

  // Start the dev server automatically when running locally
  webServer: process.env.CI ? undefined : {
    command: "npm run dev",
    url:     "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
