import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// O servidor de teste lê .env.local sozinho (Next faz isso), o processo do
// Playwright não. Sem isso, todo teste de painel se pula por falta de
// ADMIN_SEED_EMAIL e a suíte passa verde sem ter exercido o painel. Mesmo
// recurso que drizzle.config.ts usa, pelo mesmo motivo. Em CI o arquivo não
// existe e nada muda.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A second retry, because the failures left are net::ERR_ABORTED on a
  // fresh page.goto: a navigation cut off by a Chromium process still
  // starting up, not a wrong assertion. That is jitter a small runner
  // produces on its own, and the honest fix for jitter is trying again, the
  // same posture Playwright's own CI guidance takes.
  retries: process.env.CI ? 2 : 0,
  // The gap in the two commits before this one: actionTimeout, navigationTimeout
  // and expect.timeout all grew, but the timeout wrapping the whole test stayed
  // at Playwright's own default, 30 seconds. A test with two navigations, each
  // now allowed up to 45s on its own, can outrun a 30s umbrella even when
  // neither navigation is individually slow enough to trip its own limit, and
  // that is what a test timeout firing mid-navigation looks like from the
  // browser's side: net::ERR_ABORTED, the page closed out from under it.
  timeout: process.env.CI ? 90_000 : undefined,
  // Bumping the two-worker cap to nothing changed the wall clock or the
  // failure count at all, which means the bottleneck was never "not enough
  // workers running at once". Going all the way to one closes the one door
  // two workers left open: two Chromium processes launching at nearly the
  // same moment, one still starting up while the runner is already busy with
  // the other, is exactly what aborts a goto mid-flight. One worker means
  // one browser alive at a time, ever.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  // Raised once already: it cleared every "Timeout: 5000ms" failure in the
  // run after it landed. Kept at the same width now that a different error
  // class is what remains.
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
      // Vazio de propósito: sem token, sendEmail registra em log em vez de
      // enviar. Com o token do .env.local, a suíte convidava usuário de
      // teste mandando e-mail de verdade para endereços @exemplo.com, o que
      // pendura a ação enquanto o Postmark responde e ainda gera bounce.
      POSTMARK_SERVER_TOKEN: "",
      // Idem para o rate limit: com as credenciais do .env.local a suíte
      // consumia o Upstash de verdade e tomava 429 de si mesma, já que os
      // testes rodam em paralelo contra os mesmos endpoints. Sem elas,
      // isRateLimited devolve falso e o limite fica desligado.
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
