import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const webApp = {
  command: "pnpm dev",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const services = {
  command: "pnpm services",
  port: 4001,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: existsSync("mock-services/package.json")
    ? [services, webApp]
    : [webApp],
});
