import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A shared two-vCPU runner falls behind a fully parallel suite hitting the
  // same Next server: the failures were never assertions being wrong, they
  // were net::ERR_ABORTED and 30s timeouts on ordinary pages, which is what
  // contention looks like, not a bug. Fewer workers means less racing for the
  // one server; a longer action timeout gives a slow response room to land
  // instead of being cut off mid-navigation. Local runs keep their own pace.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
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
