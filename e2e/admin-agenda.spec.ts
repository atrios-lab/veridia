import { neon } from "@neondatabase/serverless";
import { expect, type Page, test } from "@playwright/test";

// Entrega 7b: fila e detalhe da agenda de atendimentos.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test("a visitor with no session never reaches the queue", async ({ page }) => {
  await page.goto(`${baseURL}/admin/agenda`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fagenda$/);
});

test.describe("fila e detalhe da agenda", () => {
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

  async function seed(protocolNumber: string, sequence: number) {
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'appointment', 2098, ${sequence}, ${protocolNumber},
         'Antônio Ferreira Lima', '(84) 98888-1212', 'hash', 'requested',
         '{"date":"2098-01-05","slotHour":9,"subject":"Dúvida sobre certidão"}'::jsonb)
      on conflict do nothing
    `;
  }

  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number like 'AGD.2098.%'`;
  });

  test("the queue lists the requested band and links to the detail", async ({
    page,
  }) => {
    await seed("AGD.2098.000001", 1);
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda`);

    const row = page.locator("a", { hasText: "AGD.2098.000001" });
    await expect(row.getByText("Antônio Ferreira Lima")).toBeVisible();
    await expect(row.getByText("Pedido enviado")).toBeVisible();

    await row.click();
    await expect(
      page.getByRole("heading", { name: "AGD.2098.000001" }),
    ).toBeVisible();
    await expect(page.getByText(/Faixa pedida:/)).toBeVisible();
  });

  test("confirming the requested band updates the queue", async ({ page }) => {
    await seed("AGD.2098.000002", 2);
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/agenda/${encodeURIComponent("AGD.2098.000002")}`,
    );

    await page.getByRole("button", { name: "Confirmar este horário" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

    await page.goto(`${baseURL}/admin/agenda`);
    const row = page.locator("a", { hasText: "AGD.2098.000002" });
    await expect(row.getByText("Confirmado")).toBeVisible();
  });

  test("proposing another band keeps the original and records the proposal", async ({
    page,
  }) => {
    await seed("AGD.2098.000003", 3);
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/agenda/${encodeURIComponent("AGD.2098.000003")}`,
    );

    await page.getByRole("button", { name: "Propor outro horário" }).click();
    await page
      .getByRole("button", { name: /^(dom|seg|ter|qua|qui|sex|sáb) \d/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: /h às \d{1,2}h/ })
      .and(page.locator(":not([disabled])"))
      .first()
      .click();
    await page.getByRole("button", { name: "Propor este horário" }).click();

    await expect(page.getByText("Proposto", { exact: true })).toBeVisible();
    await expect(page.getByText(/Faixa proposta:/)).toBeVisible();
    await expect(page.getByText(/Faixa pedida: .*9h/)).toBeVisible();
  });

  test("cancelling the request marks it cancelled", async ({ page }) => {
    await seed("AGD.2098.000004", 4);
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/agenda/${encodeURIComponent("AGD.2098.000004")}`,
    );

    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect(page.getByText("Cancelar este pedido?")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  });

  test("marking a confirmed appointment attended closes it", async ({
    page,
  }) => {
    await seed("AGD.2098.000005", 5);
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/agenda/${encodeURIComponent("AGD.2098.000005")}`,
    );
    await page.getByRole("button", { name: "Confirmar este horário" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Marcar como atendido" }).click();
    await expect(page.getByText("Atendido", { exact: true })).toBeVisible();
  });
});
