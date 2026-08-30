import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 10: transparência: documentos públicos e boletim mensal. Same
// discipline as e2e/admin-publications.spec.ts: the screen is behind the
// login, so everything but the session gate skips without a database and the
// seeded admin account. Cleanup is by the fixed labels below: the dev
// database is the production one, so a leaked row is a real row on a real
// office's public page.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const TENANT = "cartorio-marinho";
const DOC_TITLE = "Documento de teste e2e";
// A month far in the future so a real bulletin is never overwritten by a test.
const TEST_MONTH = "2099-08-01";

test("a visitor with no session never reaches the transparency screen", async ({
  page,
}) => {
  await page.goto(`${baseURL}/admin/transparencia`);
  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Ftransparencia$/,
  );
});

// The institutional notices are fixed text, not rows: no login and no seeded
// account. They still need the database, because the page around them reads
// documents and bulletins before it renders anything.
test.describe("avisos institucionais", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: a página pública lê documentos e boletins",
  );

  test("the public page carries both notices, named after the office", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/transparencia`);

    const notices = page.getByRole("region", { name: "Avisos institucionais" });
    await expect(
      notices.getByRole("heading", { name: "Prevenção à lavagem de dinheiro" }),
    ).toBeVisible();
    await expect(
      notices.getByRole("heading", {
        name: "Atos que envolvem pessoas idosas",
      }),
    ).toBeVisible();

    // The office's own name, not a generic "esta serventia".
    await expect(notices.getByText(/Cartório/)).toHaveCount(2);

    // The way to the rule itself is on the page, at the CNJ, not a copy here.
    await expect(
      notices.getByRole("link", { name: "Provimento CNJ nº 149/2023" }),
    ).toHaveAttribute("href", /atos\.cnj\.jus\.br/);
  });
});

test.describe("transparência", () => {
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
    await sql`delete from transparency_documents where tenant_slug = ${TENANT} and title = ${DOC_TITLE}`;
    await sql`delete from transparency_bulletins where tenant_slug = ${TENANT} and reference_month = ${TEST_MONTH}`;
  });

  test("uploading a document lands it as a draft, off the public page", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/transparencia`);

    await page.getByLabel("Nome do documento").fill(DOC_TITLE);
    await page.getByLabel("Ano ou vigência").fill("2099");
    await page.setInputFiles('input[name="arquivo"]', {
      name: "tabela.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste e2e"),
    });
    await page.getByRole("button", { name: "Enviar como rascunho" }).click();

    const row = page.locator("div", { hasText: DOC_TITLE }).last();
    await expect(row.getByText("Rascunho")).toBeVisible();

    // A draft is not on the public page.
    await page.goto(`${baseURL}/transparencia`);
    await expect(page.getByText(DOC_TITLE)).toHaveCount(0);
  });

  test("publishing puts the document on the public page", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/transparencia`);
    await page.getByLabel("Nome do documento").fill(DOC_TITLE);
    await page.getByLabel("Ano ou vigência").fill("2099");
    await page.setInputFiles('input[name="arquivo"]', {
      name: "tabela.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste e2e"),
    });
    await page.getByRole("button", { name: "Enviar como rascunho" }).click();

    const row = page.locator("div", { hasText: DOC_TITLE }).last();
    await row.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(row.getByText("Publicado")).toBeVisible();

    await page.goto(`${baseURL}/transparencia`);
    await expect(page.getByText(DOC_TITLE)).toBeVisible();
  });

  test("removing a document asks for confirmation, then deletes", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/transparencia`);
    await page.getByLabel("Nome do documento").fill(DOC_TITLE);
    await page.getByLabel("Ano ou vigência").fill("2099");
    await page.setInputFiles('input[name="arquivo"]', {
      name: "tabela.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste e2e"),
    });
    await page.getByRole("button", { name: "Enviar como rascunho" }).click();

    const row = page.locator("div", { hasText: DOC_TITLE }).last();
    await row.getByRole("button", { name: "Remover" }).click();
    // The panel opens a dialog; only its button deletes.
    await expect(page.getByText("Remover este documento?")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar remoção" }).click();

    await expect(page.getByText(DOC_TITLE)).toHaveCount(0);
  });

  test("the bulletin computes the balance and publishes to the site", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/transparencia?aba=boletim`);

    await page.getByLabel("Mês", { exact: true }).selectOption("8");
    await page.getByLabel("Ano").fill("2099");
    await page.getByLabel("Atos praticados").fill("412");
    await page.getByLabel("Arrecadação bruta do mês (R$)").fill("48.230,10");
    await page.getByLabel(/Tributos pagos/).fill("9.612,44");
    await page.getByLabel("Despesas (R$)").fill("21.480,00");

    // The balance is computed, not typed: the screen's own example.
    await expect(page.getByText("R$ 17.137,66").first()).toBeVisible();

    await page.getByRole("button", { name: "Publicar no site" }).click();
    // "Agosto de 2099" sozinho já aparece na pré-visualização do formulário,
    // antes de existir boletim: esperar por ele deixava o teste navegar para
    // o site com a ação ainda em voo. Esta linha só existe depois de gravar.
    await expect(
      page.getByText("Último publicado: Agosto de 2099"),
    ).toBeVisible();

    // It reaches the public page with the preliminary tag.
    await page.goto(`${baseURL}/transparencia`);
    await expect(page.getByText("Agosto de 2099")).toBeVisible();
    await expect(page.getByText("Dados preliminares").first()).toBeVisible();
  });

  test("consolidating replaces the month's preliminary bulletin", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into transparency_bulletins
        (tenant_slug, reference_month, acts_count, gross_revenue_cents,
         taxes_paid_cents, expenses_cents, status)
      values (${TENANT}, ${TEST_MONTH}, 412, 4823010, 961244, 2148000,
              'preliminary')
    `;

    await signIn(page);
    await page.goto(`${baseURL}/admin/transparencia?aba=boletim`);
    await page.getByLabel("Mês", { exact: true }).selectOption("8");
    await page.getByLabel("Ano").fill("2099");
    await page.getByLabel("Atos praticados").fill("412");
    await page.getByLabel("Arrecadação bruta do mês (R$)").fill("48.230,10");
    await page.getByLabel(/Tributos pagos/).fill("9.612,44");
    await page.getByLabel("Despesas (R$)").fill("21.480,00");
    await page.getByRole("button", { name: "Consolidado" }).click();
    await page.getByRole("button", { name: "Publicar no site" }).click();

    // Exactly one August 2099, now consolidated: the unique index enforced it.
    // Por polling: a consulta direta chegava antes de a ação gravar.
    await expect
      .poll(async () => {
        const rows =
          await sql`select status from transparency_bulletins where tenant_slug = ${TENANT} and reference_month = ${TEST_MONTH}`;
        return rows.map((r) => r.status);
      })
      .toEqual(["consolidated"]);
  });
});
