import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two vCPUs did not turn out to be the story: the 2-worker cap changed
  // nothing (still 6 failed, still ~7 minutes), and the failures themselves
  // read "Timeout: 5000ms", which is `expect()`'s own poll timeout, a clock
  // this file never touched. Fifteen retries in one run mostly succeeded on
  // their second attempt, which is what a too-tight budget looks like under
  // a slower machine, not exhaustion: exhaustion would keep failing on retry.
  // Local runs never miss the 5s default because the machine answers fast
  // enough that the assertion never needs to poll past the first tick.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: process.env.CI ? 15_000 : undefined },
  use: {
    trace: "on-first-retry",
    actionTimeout: process.env.CI ? 15_000 : undefined,
    navigationTimeout: process.env.CI ? 45_000 : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The production build, not the dev server: the test asserts what the
    // office actually serves.
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    port: Number(PORT),
    // Throwaway values so the server boots with no secret anywhere. They
    // protect nothing: no session is created and no database is reached.
    env: {
      BETTER_AUTH_SECRET: "e2e-sem-valor-nenhum-fora-deste-processo-de-teste",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      DEFAULT_TENANT: "cartorio-marinho",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
