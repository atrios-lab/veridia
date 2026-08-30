import { expect, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 5: login e autenticação do painel. The warning states
// (erro/motivo/saiu) are pure rendering off searchParams, so they need no
// database; signing in for real, the cross-tenant refusal and a revoked
// session do, and say so.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const auroraURL = `http://aurora.localhost:${PORT}`;

test.describe("estados de aviso (sem banco)", () => {
  test("a fresh visit shows the office identity and no warning", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/login`);
    await expect(
      page.getByRole("heading", { name: "Painel administrativo da serventia" }),
    ).toBeVisible();
    await expect(page.getByText("Cartório Marinho")).toBeVisible();
    await expect(page.locator("[data-admin-banner]")).toHaveCount(0);
  });

  test("the generic credential error and the rate-limit warning render distinctly", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/login?erro=1`);
    await expect(page.locator('[data-admin-banner="erro"]')).toHaveText(
      "E-mail ou senha inválidos.",
    );
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();

    await page.goto(`${baseURL}/admin/login?erro=limite`);
    await expect(page.locator('[data-admin-banner="limite"]')).toHaveText(
      "Muitas tentativas. Aguarde um instante e tente de novo.",
    );
    await expect(page.getByRole("button", { name: "Aguarde…" })).toBeDisabled();
  });

  test("session-expired and logged-out notices name the right destination", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/login?motivo=expirada&next=%2Fadmin`);
    await expect(page.locator('[data-admin-banner="expirada"]')).toContainText(
      "Sua sessão terminou. Entre de novo para voltar ao painel.",
    );

    await page.goto(`${baseURL}/admin/login?saiu=1`);
    await expect(page.locator('[data-admin-banner="saiu"]')).toContainText(
      "Você saiu do painel.",
    );
  });

  test("an unauthenticated visit to a protected route redirects with no session notice", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin`);
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.locator("[data-admin-banner]")).toHaveCount(0);
  });

  test("the panel carries each office's own theme, not a shared fixed one", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/login`);
    const marinhoTheme = await page
      .locator("[data-theme]")
      .first()
      .getAttribute("data-theme");
    expect(marinhoTheme).toBe("verde-dourado");

    await page.goto(`${auroraURL}/admin/login`);
    const auroraTheme = await page
      .locator("[data-theme]")
      .first()
      .getAttribute("data-theme");
    expect(auroraTheme).not.toBe(marinhoTheme);
  });
});

test.describe("autenticação de verdade", () => {
  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.ADMIN_SEED_EMAIL ||
      !process.env.ADMIN_SEED_PASSWORD,
    "precisa de DATABASE_URL, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD: exercita o login de verdade",
  );

  const email = process.env.ADMIN_SEED_EMAIL as string;
  const password = process.env.ADMIN_SEED_PASSWORD as string;

  async function signIn(page: import("@playwright/test").Page, url: string) {
    await page.goto(url);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  test("correct credentials enter the panel, wrong ones show the generic error", async ({
    page,
  }) => {
    await signIn(page, `${baseURL}/admin/login`);
    await expect(page).toHaveURL(`${baseURL}/admin`);

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/admin\/login\?saiu=1$/);
    await expect(page.locator('[data-admin-banner="saiu"]')).toContainText(
      "Você saiu do painel.",
    );

    await page.goto(`${baseURL}/admin/login`);
    await page.getByLabel("E-mail").fill(email);
    await page
      .getByLabel("Senha", { exact: true })
      .fill("senha-errada-de-proposito");
    await page.getByRole("button", { name: "Entrar" }).click();
    // O redirect preserva o e-mail digitado para repreencher o campo, então
    // a URL continua depois de `erro=1`.
    await expect(page).toHaveURL(/\/admin\/login\?erro=1(&|$)/);
    await expect(page.locator('[data-admin-banner="erro"]')).toHaveText(
      "E-mail ou senha inválidos.",
    );
  });

  test("credentials valid for one office are refused on another's domain", async ({
    page,
  }) => {
    await signIn(page, `${auroraURL}/admin/login`);
    // Same generic message as a wrong password: it never says the account
    // belongs to a different office.
    await expect(page).toHaveURL(/\/admin\/login\?erro=1(&|$)/);
    await expect(page.locator('[data-admin-banner="erro"]')).toHaveText(
      "E-mail ou senha inválidos.",
    );
  });

  test("a revoked session sends the visitor back to login, and signing in again returns them to /admin", async ({
    page,
  }) => {
    await signIn(page, `${baseURL}/admin/login`);
    await expect(page).toHaveURL(`${baseURL}/admin`);

    // The browser still holds a cookie for this session; the database no
    // longer honours it, the same as an expiry or a revocation would leave
    // it. That mismatch is exactly what the redirect has to catch.
    //
    // Only this page's own session is revoked, found by the token its cookie
    // carries. Deleting every session of the seeded account instead would
    // sign out whatever other spec file is signed in as the same user at the
    // same moment, and that failure reads as a bug in their screen.
    const cookies = await page.context().cookies();
    const token = cookies
      .find((cookie) => cookie.name.endsWith("session_token"))
      ?.value.split(".")[0];
    expect(token, "a sessão precisa existir para ser revogada").toBeTruthy();
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from session where token = ${token as string}`;

    await page.goto(`${baseURL}/admin`);
    await expect(page).toHaveURL(
      `${baseURL}/admin/login?next=%2Fadmin&motivo=expirada`,
    );
    await expect(page.locator('[data-admin-banner="expirada"]')).toContainText(
      "Sua sessão terminou. Entre de novo para voltar ao painel.",
    );

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin`);

    await page.getByRole("button", { name: "Sair" }).click();
  });
});

test.describe("superadmin da Átrios", () => {
  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.SUPERADMIN_SEED_EMAIL ||
      !process.env.SUPERADMIN_SEED_PASSWORD,
    "precisa de DATABASE_URL, SUPERADMIN_SEED_EMAIL e SUPERADMIN_SEED_PASSWORD (pnpm db:seed-superadmin)",
  );

  const email = process.env.SUPERADMIN_SEED_EMAIL as string;
  const password = process.env.SUPERADMIN_SEED_PASSWORD as string;

  async function signIn(page: import("@playwright/test").Page, url: string) {
    await page.goto(url);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  test("the same account enters the panel of two different offices", async ({
    page,
  }) => {
    await signIn(page, `${baseURL}/admin/login`);
    await expect(page).toHaveURL(`${baseURL}/admin`);
    await page.getByRole("button", { name: "Sair" }).click();

    await signIn(page, `${auroraURL}/admin/login`);
    await expect(page).toHaveURL(`${auroraURL}/admin`);
    // Asserted with no reload in between, on purpose: the panel that opens
    // straight out of the sign-in redirect used to be the DEFAULT_TENANT
    // office, and reloading was what "fixed" it. Checking only the URL is
    // what let that ship.
    await expect(page.getByText("Tabelionato Aurora").first()).toBeVisible();
    await expect(page.getByText("Cartório Marinho")).toHaveCount(0);
    await page.getByRole("button", { name: "Sair" }).click();
  });

  test("sign-in is audited under the office actually accessed", async ({
    page,
  }) => {
    await signIn(page, `${auroraURL}/admin/login`);
    await expect(page).toHaveURL(`${auroraURL}/admin`);

    const sql = postgres(process.env.DATABASE_URL as string);
    const rows = await sql`
      select tenant_slug from audit_log
      where actor_id = (select id from "user" where email = ${email})
        and action = 'session.sign-in'
      order by created_at desc limit 1
    `;
    expect(rows[0]?.tenant_slug).toBe("tabelionato-aurora");

    await page.getByRole("button", { name: "Sair" }).click();
  });
});
