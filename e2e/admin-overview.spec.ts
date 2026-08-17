import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 7a v2: a mesa de trabalho. Roda depois dos outros três canais
// (Agenda, Ouvidoria, LGPD), que a Visão geral só agrega.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const SOL_DUE_SOON = "SOL.2097.000001";
const REQ_STALLED = "REQ.2097.000001";
// A agenda de hoje vem da própria tabela de agendamentos, sem protocolo.
const AGENDA_TOKEN_HASH = "hash-overview-2097";

/** The office's wall calendar day, same computation as `toIsoDate` in
 * src/core/scheduling/calendar.ts: "Agenda de hoje" filters on this. */
function officeToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

test.describe("Visão geral (mesa de trabalho)", () => {
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
    // Due in one day: filed thirteen days ago, term ends day 15 (the mesa's
    // most urgent tier).
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
    // Em análise with a fulfilled requirement and none pending: the mesa's
    // second tier, "Retomar análise".
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'service-request', 2097, 1, ${REQ_STALLED},
         'Rosa Almeida Fontes', 'rosa@email.com', 'hash', 'in-review', '{}'::jsonb)
      on conflict do nothing
    `;
    const [request] = await sql`
      select id from service_requests where protocol_number = ${REQ_STALLED}
    `;
    await sql`
      insert into service_request_requirements (tenant_slug, request_id, text, status, fulfilled_at)
      values ('cartorio-marinho', ${request.id}, 'Documento de identidade', 'fulfilled', now())
    `;
    // Um agendamento para hoje: alimenta o atalho "Agenda do dia" e o bloco
    // "Agenda de hoje". Já está marcado — nada aqui espera confirmação.
    await sql`
      insert into appointments
        (tenant_slug, date, slot_time, citizen_name, email, phone,
         service_id, service_label, mode, status, cancel_token_hash)
      values
        ('cartorio-marinho', ${officeToday()}, '14:00',
         'Antônio Ferreira Lima', 'antonio@exemplo.com', '(84) 98888-1212',
         'procuracao', 'Procuração', 'Presencial', 'booked',
         ${AGENDA_TOKEN_HASH})
      on conflict do nothing
    `;
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_request_requirements where request_id in (
      select id from service_requests where protocol_number = ${REQ_STALLED}
    )`;
    await sql`delete from service_requests where protocol_number in (${SOL_DUE_SOON}, ${REQ_STALLED})`;
    await sql`delete from appointments where cancel_token_hash = ${AGENDA_TOKEN_HASH}`;
  });

  test("a mesa lista o requerimento LGPD perto do prazo antes da exigência cumprida, cada um com o próximo passo", async ({
    page,
  }) => {
    await signIn(page);
    const desk = page.getByText("Sua mesa hoje").locator("..").locator("..");

    const solRow = desk.getByText(SOL_DUE_SOON).locator("../..");
    const reqRow = desk.getByText(REQ_STALLED).locator("../..");
    await expect(solRow).toBeVisible();
    await expect(reqRow).toBeVisible();

    const solBox = await solRow.boundingBox();
    const reqBox = await reqRow.boundingBox();
    expect(solBox && reqBox && solBox.y).toBeLessThan(reqBox?.y ?? Infinity);

    await expect(
      solRow.getByRole("link", { name: "Responder agora" }),
    ).toHaveAttribute("href", `/admin/lgpd/${SOL_DUE_SOON}`);
    await expect(
      reqRow.getByRole("link", { name: "Retomar análise" }),
    ).toHaveAttribute("href", `/admin/pedidos/${REQ_STALLED}`);
  });

  test("o atalho da agenda conta os atendimentos de hoje e leva à agenda", async ({
    page,
  }) => {
    await signIn(page);
    const shortcut = page.getByRole("link", {
      name: /Agenda do dia.*atendimentos?/,
    });
    await expect(shortcut).toBeVisible();
    await shortcut.click();
    await expect(page).toHaveURL(`${baseURL}/admin/agenda`);
  });

  test("a agenda de hoje mostra o atendimento marcado, sem pedir confirmação", async ({
    page,
  }) => {
    await signIn(page);
    const agenda = page.getByText("Agenda de hoje").locator("..").locator("..");
    await expect(agenda).toContainText("Antônio Ferreira Lima");
    await expect(agenda).toContainText("14:00");
    await expect(agenda).toContainText("Procuração");
    await expect(agenda).not.toContainText("aguardando");
  });

  test("situação dos canais leva à fila do canal", async ({ page }) => {
    await signIn(page);
    const link = page.getByRole("link", {
      name: /requerimentos LGPD em aberto/,
    });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(`${baseURL}/admin/lgpd`);
  });
});
