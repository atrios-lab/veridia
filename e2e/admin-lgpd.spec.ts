import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { hashAccessKey } from "../src/core/request/access-key.ts";

// Entrega 7d: fila e detalhe de requerimentos LGPD.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const DUE_SOON = "SOL.2098.000001";
const OVERDUE = "SOL.2098.000002";
const ACCESS_KEY = "TEST-KEYS-0001";

test("a visitor with no session never reaches the queue", async ({ page }) => {
  await page.goto(`${baseURL}/admin/lgpd`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Flgpd$/);
});

test.describe("fila e detalhe de requerimentos LGPD", () => {
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

  test.beforeEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    // Due in three days: filed today, term ends day 15.
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, description, access_key_hash, status, details, created_at)
      values
        ('cartorio-marinho', 'data-rights', 2098, 1, ${DUE_SOON},
         'Maria José da Silva', 'maria@email.com', 'Quero saber quais dados vocês têm sobre mim.',
         ${hashAccessKey(ACCESS_KEY)}, 'new', '{"right":"access"}'::jsonb,
         now() - interval '12 days')
      on conflict do nothing
    `;
    // Already past the fifteen day term.
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, description, access_key_hash, status, details, created_at)
      values
        ('cartorio-marinho', 'data-rights', 2098, 2, ${OVERDUE},
         'Everton Batista Souza', 'everton@email.com', 'Corrijam meu endereço no cadastro.',
         ${hashAccessKey("TEST-KEYS-0002")}, 'new', '{"right":"rectification"}'::jsonb,
         now() - interval '17 days')
      on conflict do nothing
    `;
    await sql.end();
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number like 'SOL.2098.%'`;
    await sql.end();
  });

  test("the queue shows the deadline for each requerimento", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/lgpd`);

    const dueRow = page.locator("a", { hasText: DUE_SOON });
    await expect(dueRow.getByText(/Vence em \d dias?/)).toBeVisible();

    const overdueRow = page.locator("a", { hasText: OVERDUE });
    await expect(
      overdueRow.getByText(/Prazo vencido há \d dias?/),
    ).toBeVisible();
  });

  test("responding makes the reply reachable by the titular's consult", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/lgpd/${encodeURIComponent(DUE_SOON)}`);
    await expect(page.getByRole("heading", { name: DUE_SOON })).toBeVisible();
    await expect(page.getByText("Acesso aos dados")).toBeVisible();

    await page
      .getByPlaceholder(/Escreva a resposta/)
      .fill("Localizamos seus dados: seguem em anexo.");
    await page
      .getByRole("button", { name: "Enviar resposta e concluir" })
      .click();
    await expect(page.getByText("Resposta enviada")).toBeVisible();

    await page.goto(`${baseURL}/protocolo?numero=${DUE_SOON}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Localizamos seus dados: seguem em anexo."),
    ).toBeVisible();
  });

  test("saving a draft does not answer the requerimento nor notify the titular", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/lgpd/${encodeURIComponent(OVERDUE)}`);

    await page
      .getByPlaceholder(/Escreva a resposta/)
      .fill("Rascunho: ainda apurando o pedido de correção.");
    await page.getByRole("button", { name: "Salvar rascunho" }).click();
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();

    await page.goto(`${baseURL}/admin/lgpd/${encodeURIComponent(OVERDUE)}`);
    await expect(page.getByPlaceholder(/Escreva a resposta/)).toHaveValue(
      "Rascunho: ainda apurando o pedido de correção.",
    );

    await page.goto(`${baseURL}/protocolo?numero=${OVERDUE}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill("TEST-KEYS-0002");
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Rascunho: ainda apurando o pedido de correção."),
    ).not.toBeVisible();
  });
});
