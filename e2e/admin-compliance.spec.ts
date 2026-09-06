import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Módulo "Adequação ao Provimento": a resposta dada numa seção sobrevive a
// sair e voltar, e a resposta que gera pendência avisa na hora. Precisa de
// sessão e de banco, então o arquivo inteiro pula sem eles.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("adequação ao Provimento", () => {
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

  // The intake is one row per office; every test starts from none.
  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from compliance_intakes where tenant_slug = 'cartorio-marinho'`;
    await sql.end();
  });

  test("an answer saves itself, warns at once, and is there when the office comes back", async ({
    page,
  }) => {
    await signIn(page);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Adequação ao Provimento" })
      .click();
    await expect(page).toHaveURL(`${baseURL}/admin/adequacao`);
    await expect(page.getByText("0 de 17 seções")).toBeVisible();

    await page.getByRole("link", { name: /Softwares e licenças/ }).click();
    await page.getByLabel("Windows 10", { exact: true }).check();
    await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
    await expect(
      page.getByText("O Windows 10 está sem suporte desde 14/10/2025."),
    ).toBeVisible();

    // Out and back in: the answer is on the server, not in the tab.
    await page.goto(`${baseURL}/admin/adequacao/softwares`);
    await expect(page.getByLabel("Windows 10", { exact: true })).toBeChecked();

    await page.goto(`${baseURL}/admin/adequacao`);
    await expect(
      page.getByRole("link", { name: /Softwares e licenças/ }),
    ).toContainText("em andamento");
    await expect(
      page.getByRole("link", { name: /Softwares e licenças/ }),
    ).toContainText("1 aviso");
    // The export is the Átrios profile's alone.
    await expect(page.getByRole("link", { name: /Exportar JSON/ })).toHaveCount(
      0,
    );
  });
});
