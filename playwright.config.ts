import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "on-first-retry" },
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
