import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Agenda do dia no painel: listar, atender, cancelar com motivo e fechar o dia.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

// Uma data no futuro distante, para nunca colidir com dados reais nem com o
// "hoje" que a tela abre por padrão. 2098-01-06 é uma quinta-feira.
const DATE = "2098-01-06";

test("a visitor with no session never reaches the agenda", async ({ page }) => {
  await page.goto(`${baseURL}/admin/agenda`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fagenda$/);
});

test.describe("agenda do dia", () => {
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

  async function seed(slotTime: string, citizenName: string) {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into appointments
        (tenant_slug, date, slot_time, citizen_name, email, phone,
         service_id, service_label, mode, status, cancel_token_hash)
      values
        ('cartorio-marinho', ${DATE}, ${slotTime}, ${citizenName},
         'teste@exemplo.com', '(84) 98888-1212', 'procuracao', 'Procuração',
         'Presencial', 'booked', ${`hash-${slotTime}`})
      on conflict do nothing
    `;
    await sql.end();
  }

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from appointments where date = ${DATE}`;
    await sql.end();
  });

  test("the day lists who is coming, at what time and for what", async ({
    page,
  }) => {
    await seed("09:00", "Antônio Ferreira Lima");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await expect(page.getByText("Antônio Ferreira Lima")).toBeVisible();
    await expect(page.getByText("09:00")).toBeVisible();
    await expect(page.getByText("Procuração")).toBeVisible();
    await expect(page.getByText("Agendado", { exact: true })).toBeVisible();
  });

  test("marking attended closes the appointment", async ({ page }) => {
    await seed("10:00", "Maria José da Silva");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await page.getByRole("button", { name: "Atendido" }).click();
    await expect(page.getByText("Atendido", { exact: true })).toBeVisible();
  });

  test("cancelling one appointment demands a reason", async ({ page }) => {
    await seed("11:00", "Sérgio Alves");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await page.getByRole("button", { name: "Cancelar" }).click();
    // O motivo é obrigatório: é ele que o cidadão lê no e-mail.
    await expect(page.getByLabel(/Motivo do cancelamento/)).toBeVisible();
    await page
      .getByLabel(/Motivo do cancelamento/)
      .fill("O tabelião foi convocado para uma diligência.");
    await page.getByRole("button", { name: "Cancelar e avisar" }).click();

    await expect(page.getByText(/cidadão avisado/i)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
    await expect(page.getByText(/diligência/)).toBeVisible();
  });

  test("closing the day cancels everyone on it and stops offering the date", async ({
    page,
  }) => {
    await seed("09:00", "Antônio Ferreira Lima");
    await seed("14:00", "Joana Barros");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await page.getByRole("button", { name: "Fechar o dia" }).click();
    await expect(
      page.getByText(/2 agendamentos serão cancelados/),
    ).toBeVisible();
    await page
      .getByLabel("Motivo", { exact: false })
      .fill("A serventia não abrirá por falta de energia elétrica.");
    await page.getByRole("button", { name: "Fechar o dia e avisar" }).click();

    await expect(page.getByText(/2 cidadãos avisados/)).toBeVisible();

    await page.reload();
    await expect(page.getByText("Este dia está fechado")).toBeVisible();
    await expect(page.getByText(/falta de energia/)).toBeVisible();
    // Reabrir devolve a data à oferta; quem já foi cancelado segue cancelado.
    await page.getByRole("button", { name: "Reabrir o dia" }).click();
    await expect(page.getByText("Dia reaberto.")).toBeVisible();
  });
});
