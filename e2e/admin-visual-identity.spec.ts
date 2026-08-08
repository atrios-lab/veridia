import { neon } from "@neondatabase/serverless";
import { expect, type Page, test } from "@playwright/test";

// Entrega 4: painel administrativo, aba Identidade Visual. Same shape as
// admin-settings.spec.ts: a real session and a real row are what the screen
// is for, so the whole file skips without a database.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("configurações, aba Identidade Visual", () => {
  // Serial: every test writes and clears the one override row for the pilot
  // office. In parallel they read each other's half-finished edits.
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

  // Each test leaves the office as it found it: the override row is what the
  // public site serves, so a test that forgets it changes the next one.
  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-brand'`;
  });

  test("publishing a style repaints the public site", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);

    // The radio is visually hidden inside its card-shaped <label>, the same
    // way a mouse actually picks a style: click the card, not the input.
    await page.getByText("Marinho & Bronze").click();
    await page.getByRole("button", { name: "Salvar e publicar" }).click();
    await expect(page.getByText("Publicado.")).toBeVisible();

    await page.goto(`${baseURL}/`);
    // Marinho & Bronze's serif is Libre Baskerville; the pilot's own is
    // Spectral. The computed font family is what a screenshot cannot fake.
    const family = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain("Libre Baskerville");
  });

  test("publishing the welcome title changes the public hero", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);

    const novoTitulo = "Título publicado pelo e2e";
    await page.getByLabel("Título de boas-vindas").fill(novoTitulo);
    await page.getByRole("button", { name: "Salvar e publicar" }).click();
    await expect(page.getByText("Publicado.")).toBeVisible();

    await page.goto(`${baseURL}/`);
    await expect(page.getByRole("heading", { name: novoTitulo })).toBeVisible();
  });

  test("discarding never reaches the public site", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);

    const tituloOriginal = await page
      .getByLabel("Título de boas-vindas")
      .inputValue();
    await page.getByLabel("Título de boas-vindas").fill("Nunca publicado");
    await page.getByRole("button", { name: "Descartar mudanças" }).click();
    await expect(page.getByLabel("Título de boas-vindas")).toHaveValue(
      tituloOriginal,
    );

    await page.goto(`${baseURL}/`);
    await expect(
      page.getByRole("heading", { name: "Nunca publicado" }),
    ).toHaveCount(0);
  });

  test("turning off an optional section takes its route off the air", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);

    // Same reasoning as the theme card above: the checkbox is visually
    // hidden inside the row's <label>, so a real click lands on the row.
    const editaisRow = page.locator("label").filter({ hasText: "Editais" });
    await editaisRow.click();
    await expect(editaisRow.getByRole("checkbox")).not.toBeChecked();
    await page.getByRole("button", { name: "Salvar e publicar" }).click();
    await expect(page.getByText("Publicado.")).toBeVisible();

    const response = await page.request.get(`${baseURL}/editais`);
    expect(response.status()).toBe(404);
  });

  test("a mandatory section has no control at all", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);

    for (const label of [
      "Início",
      "Canal LGPD",
      "Ouvidoria",
      "Transparência",
    ]) {
      const row = page.locator("div").filter({ hasText: label }).last();
      await expect(row.locator("input, button, [role='switch']")).toHaveCount(
        0,
      );
    }
  });

  test("the tab strip offers Serventia and Identidade Visual as real links", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes`);

    // Two links share this text: the tab strip and the footer note under
    // Atribuições da serventia. The tab strip's is the first on the page.
    await page.getByRole("link", { name: "Identidade Visual" }).first().click();
    await expect(page).toHaveURL(
      `${baseURL}/admin/configuracoes/identidade-visual`,
    );
    await expect(
      page
        .locator('[aria-current="page"]')
        .filter({ hasText: "Identidade Visual" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Serventia" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin/configuracoes`);
  });
});

test("a visitor with no session never reaches the visual identity screen", async ({
  page,
}) => {
  await page.goto(`${baseURL}/admin/configuracoes/identidade-visual`);
  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fconfiguracoes%2Fidentidade-visual$/,
  );
});
