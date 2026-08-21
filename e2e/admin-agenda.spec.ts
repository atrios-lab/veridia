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
    // Um teste que fechou o dia e falhou antes de reabrir não pode
    // envenenar a próxima rodada: a data sai de closedDates sempre.
    await sql`
      update tenant_content
      set published = jsonb_set(
        published,
        '{closedDates}',
        coalesce(
          (select jsonb_agg(closed) from jsonb_array_elements(published->'closedDates') closed
            where closed->>'date' <> ${DATE}),
          '[]'::jsonb
        )
      )
      where tenant_slug = 'cartorio-marinho' and key = 'office-agenda'
        and published ? 'closedDates'
    `;
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

    await page.getByRole("button", { name: "Marcar atendido" }).click();
    await expect(page.getByText("Atendido", { exact: true })).toBeVisible();
  });

  test("marking a no-show records it without emailing anyone", async ({
    page,
  }) => {
    await seed("10:00", "Josefa Dantas");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await page.getByRole("button", { name: "Faltou" }).click();
    await expect(page.getByText("Faltou", { exact: true })).toBeVisible();
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

  // A tela de configuração já foi inalcançável: o único link para ela vivia
  // dentro do aviso de grade vazia, que some no primeiro horário salvo.
  test("the configuration screen stays reachable once the grid is filled", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [before] = await sql`
      select published from tenant_content
      where tenant_slug = 'cartorio-marinho' and key = 'office-agenda'
    `;
    await sql`
      insert into tenant_content (tenant_slug, key, published, published_at)
      values ('cartorio-marinho', 'office-agenda',
              ${sql.json({ grid: { "4": ["09:00"] }, services: [{ id: "procuracao", label: "Procuração" }], modes: ["Presencial"], closedDates: [] })},
              now())
      on conflict (tenant_slug, key)
        do update set published = excluded.published, published_at = now()
    `;

    try {
      await signIn(page);
      await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);
      // Com a grade preenchida o aviso não existe, e o caminho tem de existir
      // mesmo assim.
      await expect(
        page.getByText("A agenda ainda não tem horários"),
      ).toHaveCount(0);
      await page.getByRole("link", { name: /Configurar horários/ }).click();

      await expect(page).toHaveURL(`${baseURL}/admin/agenda/configuracao`);
      // A grade agora é um chip por horário; o × acessível nomeia o dia.
      await expect(
        page.getByRole("button", { name: "Remover 09:00 de quinta" }),
      ).toBeVisible();
    } finally {
      if (before?.published) {
        await sql`
          update tenant_content set published = ${sql.json(before.published)}
          where tenant_slug = 'cartorio-marinho' and key = 'office-agenda'
        `;
      } else {
        await sql`
          delete from tenant_content
          where tenant_slug = 'cartorio-marinho' and key = 'office-agenda'
        `;
      }
      await sql.end();
    }
  });

  test("closing the day cancels everyone on it and stops offering the date", async ({
    page,
  }) => {
    await seed("09:00", "Antônio Ferreira Lima");
    await seed("14:00", "Joana Barros");
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda?dia=${DATE}`);

    await page.getByRole("button", { name: /^Fechar .+\.\.\.$/ }).click();
    await expect(
      page.getByText(/2 agendamentos de .+ são cancelados/),
    ).toBeVisible();
    await page
      .getByLabel("Motivo", { exact: false })
      .fill("A serventia não abrirá por falta de energia elétrica.");
    await page.getByRole("button", { name: "Fechar o dia e avisar" }).click();

    // A revalidação troca o cartão de fechar pelo de dia fechado no mesmo
    // instante em que a action volta; o estado durável é o que se afirma.
    await expect(page.getByText("Este dia está fechado")).toBeVisible();
    // O motivo aparece no cartão do dia e em cada linha cancelada.
    await expect(page.getByText(/falta de energia/).first()).toBeVisible();
    // Reabrir devolve a data à oferta; quem já foi cancelado segue cancelado.
    await page.getByRole("button", { name: "Reabrir o dia" }).click();
    // Reaberto, o cartão de fechar volta ao lugar do aviso de dia fechado.
    await expect(
      page.getByRole("button", { name: /^Fechar .+\.\.\.$/ }),
    ).toBeVisible();
  });
});
