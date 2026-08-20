import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 8b: publicações (proclamas, avisos e editais com vigência)
// automática. Everything here needs a real session and a real row, so most
// of the file skips without a database and the seeded admin account, same
// discipline as e2e/admin-service-requests.spec.ts.
//
// A staff-only scenario ("editar sem content.publish é recusado ao
// publicar") is not exercised here: scripts/seed-admin.ts only creates
// `role: "admin"`, and no e2e fixture in this repository logs in as
// `staff`. The permission split itself is proven at the core level in
// src/core/auth/roles.test.ts ("staff may edit but not publish"). Same
// resolution already used in e2e/admin-service-requests.spec.ts for a gap
// of the same shape.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const TITLE = "Edital de proclamas de teste e2e";

test("a visitor with no session never reaches the publications screen", async ({
  page,
}) => {
  await page.goto(`${baseURL}/admin/publicacoes`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpublicacoes$/);
});

test.describe("publicações", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.ADMIN_SEED_EMAIL ||
      !process.env.ADMIN_SEED_PASSWORD,
    "precisa de DATABASE_URL, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD: a tela fica atrás do login",
  );

  const email = process.env.ADMIN_SEED_EMAIL as string;
  const password = process.env.ADMIN_SEED_PASSWORD as string;

  async function signIn(page: Page) {
    await page.goto(`${baseURL}/admin/login`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin`);
  }

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from office_publications where title = ${TITLE}`;
  });

  test("saving without an entry date lands in Rascunhos", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/publicacoes`);

    await page.getByLabel("Título").fill(TITLE);
    await page
      .getByLabel("Texto")
      .fill("Corpo de teste para o rascunho do e2e.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();

    await expect(page.getByText("Salvo.")).toBeVisible();
    await page.getByRole("link", { name: /Rascunhos/ }).click();
    await expect(page.getByText(TITLE)).toBeVisible();
  });

  test("marriage banns pre-fill the exit date 15 days out", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/publicacoes`);

    await page.getByRole("button", { name: "Proclamas" }).click();
    await page.getByLabel("Entra no site em").fill("2026-09-01");

    await expect(page.getByLabel("Sai do site em")).toHaveValue("2026-09-16");
    await expect(
      page.getByText("Preenchido: 15 dias (prazo do edital)"),
    ).toBeVisible();
  });

  test("publishing puts it on the panel's No site tab and on the public home", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/publicacoes`);

    await page.getByRole("button", { name: "Aviso" }).click();
    await page.getByLabel("Título").fill(TITLE);
    await page.getByLabel("Texto").fill("Publicação vigente do teste e2e.");
    await page.getByLabel("Entra no site em").fill("2026-01-01");
    await page.getByLabel("Sai do site em").fill("2099-01-01");
    await page.getByRole("button", { name: "Publicar" }).click();

    await expect(page.getByText("Salvo.")).toBeVisible();
    await page.getByRole("link", { name: /No site/ }).click();
    await expect(page.getByText(TITLE)).toBeVisible();

    await page.goto(baseURL);
    await expect(page.getByText("Proclamas e avisos")).toBeVisible();
    await expect(page.getByText(TITLE)).toBeVisible();
  });

  test("archiving takes it off the panel's No site tab and off the home", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/publicacoes?aba=no-site`);

    const row = page.locator("div", { hasText: TITLE }).last();
    await row.getByRole("button", { name: "Arquivar agora" }).click();
    // Arming only opens the panel: nothing leaves the site until the second
    // button is pressed, which is the whole point of the confirmation.
    await expect(page.getByText("Arquivar esta publicação?")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar arquivamento" }).click();
    await expect(page.getByText("Arquivando…")).toHaveCount(0);

    await page.reload();
    await expect(page.getByText(TITLE)).toHaveCount(0);
    await page.getByRole("link", { name: /Arquivadas/ }).click();
    await expect(page.getByText(TITLE)).toBeVisible();

    await page.goto(baseURL);
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });
});
