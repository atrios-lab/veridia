import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { isWithinChatHours } from "../src/core/chat/hours.ts";
import { TENANTS } from "../src/core/tenant/resolve.ts";

// Entrega 8c/8d: o widget do cidadão. A janela de horário depende do
// relógio real no momento do teste (tenant.scheduling é config estática,
// sem como injetar "agora" num servidor de verdade): a cobertura de "fora
// do horário" fica em src/core/chat/hours.test.ts, que injeta o `Date`; aqui
// só os cenários que não dependem de que horas são agora.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test("the button never appears while the office's chat is off", async ({
  page,
}) => {
  // No database needed: the layout does not even render the component when
  // src/lib/chat.ts's isChatEnabled(tenantSlug) reads false, which is the
  // default with no tenant_content row for the "office-chat" key.
  await page.goto(baseURL);
  await expect(
    page.getByRole("button", { name: /Atendimento online/ }),
  ).toHaveCount(0);
});

test.describe("widget com o chat ligado", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: liga o chat da serventia direto no banco",
  );

  // O bloco inteiro depende do relógio, ao contrário do que o comentário do
  // topo deste arquivo supunha: fora do horário de atendimento o botão do
  // widget passa a dizer "Fora do horário de atendimento" e o fluxo de fila
  // nem existe. A cobertura de "fora do horário" é do hours.test.ts, que
  // injeta o `Date`; aqui só resta pular.
  test.skip(
    !isWithinChatHours(TENANTS["cartorio-marinho"], new Date()),
    "fora do horário de atendimento da serventia: o widget não abre fila",
  );

  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into tenant_content (tenant_slug, key, published, published_at)
      values ('cartorio-marinho', 'office-chat', '{"enabled": true}'::jsonb, now())
      on conflict (tenant_slug, key) do update set published = excluded.published
    `;
  });

  test.afterAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-chat'`;
    await sql`delete from chat_conversations where tenant_slug = 'cartorio-marinho' and subject = 'Teste e2e'`;
  });

  test("pre-chat, fila e desistência", async ({ page, context }) => {
    await page.goto(baseURL);
    const button = page.getByRole("button", { name: /Atendimento online/ });
    await expect(button).toBeVisible();
    await button.click();

    await page.getByLabel("Nome completo").fill("Rosa Almeida Fontes");
    await page.getByLabel("E-mail ou telefone").fill("rosa.fontes@email.com");
    await page.getByLabel("Assunto").fill("Teste e2e");
    await page
      .getByRole("button", { name: "Entrar na fila de atendimento" })
      .click();

    await expect(
      page.getByText(/Você é o \d+º da fila|Você está na fila/),
    ).toBeVisible();

    // The conversation id is remembered across a reload, via localStorage +
    // the httpOnly cookie the server actually checks.
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Atendimento online/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Atendimento online/ }).click();
    await page.getByRole("button", { name: "Desistir da espera" }).click();

    await expect(page.getByText("Como foi o atendimento?")).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === "chat_token" && c.httpOnly)).toBe(
      true,
    );
  });

  test("rating clears the conversation and starts fresh next time", async ({
    page,
  }) => {
    await page.goto(baseURL);
    await page.getByRole("button", { name: /Atendimento online/ }).click();

    // A conversation from the previous test is already closed and waiting
    // to be rated.
    await expect(page.getByText("Como foi o atendimento?")).toBeVisible();
    await page.getByLabel("5 estrelas").click();
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    await expect(page.getByText("Como foi o atendimento?")).toHaveCount(0);
    await page.getByRole("button", { name: /Atendimento online/ }).click();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
  });
});
