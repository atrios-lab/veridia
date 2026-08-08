import { neon } from "@neondatabase/serverless";
import { expect, type Page, test } from "@playwright/test";

// Entrega 7a: Visão geral — contadores, atividade recente e prazos a
// acompanhar. Roda depois dos outros três canais (Agenda, Ouvidoria, LGPD),
// que a Visão geral só agrega.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const AGD = "AGD.2097.000001";
const SOL_DUE_SOON = "SOL.2097.000001";

test.describe("Visão geral", () => {
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
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'appointment', 2097, 1, ${AGD},
         'Antônio Ferreira Lima', '(84) 98888-1212', 'hash', 'requested',
         '{"date":"2097-01-05","slotHour":9}'::jsonb)
      on conflict do nothing
    `;
    // The queue reads straight from the table, but "Atividade recente" reads
    // audit_log — a raw insert needs its own entry, the same one
    // `createRecord` would have written.
    await sql`
      insert into audit_log (tenant_slug, actor_id, action, target_type, target_id)
      values ('cartorio-marinho', null, 'appointment.create', 'appointment', ${AGD})
    `;
    // Due in two days: filed thirteen days ago, term ends day 15.
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, access_key_hash, status, details, created_at)
      values
        ('cartorio-marinho', 'data-rights', 2097, 1, ${SOL_DUE_SOON},
         'Maria José da Silva', 'maria@email.com', 'hash', 'new',
         '{"right":"access"}'::jsonb, now() - interval '13 days')
      on conflict do nothing
    `;
  });

  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`delete from audit_log where target_id = ${AGD}`;
    await sql`delete from service_requests where protocol_number in (${AGD}, ${SOL_DUE_SOON})`;
  });

  test("shows a counter card per channel the session can operate", async ({
    page,
  }) => {
    await signIn(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Pedidos de serviço").first()).toBeVisible();
    await expect(main.getByText("Requerimentos LGPD").first()).toBeVisible();
    await expect(main.getByText("Ouvidoria").first()).toBeVisible();
    await expect(
      main.getByText("Agenda de atendimentos").first(),
    ).toBeVisible();
  });

  test("recent activity links back to the record", async ({ page }) => {
    await signIn(page);
    const link = page.getByRole("link", { name: new RegExp(AGD) });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { name: AGD })).toBeVisible();
  });

  test("an LGPD requerimento close to its deadline appears in prazos a acompanhar", async ({
    page,
  }) => {
    await signIn(page);
    const link = page.getByRole("link", { name: new RegExp(SOL_DUE_SOON) });
    await expect(link).toBeVisible();
    await expect(link).toContainText(/vence em \d dias?/i);
  });
});
