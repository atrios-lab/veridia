import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { COOKIE_NOTICE_COOKIE } from "../src/app/(public)/_lib/cookie-notice.ts";
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

  // O widget espera o aviso de cookies: os dois moram no canto inferior
  // direito e o chat grava cookie próprio, então ele só é renderizado depois
  // que o cidadão dispensa o aviso (ver (public)/layout.tsx). Sem isto o
  // botão nunca existe, e o teste falhava desde que a trava entrou, em
  // 8d6e3d0 (10/08): ninguém viu porque ele se pula fora do expediente da
  // serventia, que é quando o CI quase sempre roda.
  test.beforeEach(async ({ context }) => {
    // Por `url` e não por `domain`: o host de teste carrega porta, e o par
    // domínio/caminho escrito à mão erra calado, deixando o cookie de fora.
    await context.addCookies([
      { name: COOKIE_NOTICE_COOKIE, value: "1", url: baseURL },
    ]);
  });

  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into tenant_content (tenant_slug, key, published, published_at)
      values ('cartorio-marinho', 'office-chat', '{"enabled": true}'::jsonb, now())
      on conflict (tenant_slug, key) do update set published = excluded.published
    `;
    await sql.end();
  });

  test.afterAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-chat'`;
    await sql`delete from chat_conversations where tenant_slug = 'cartorio-marinho' and subject = 'Teste e2e'`;
    await sql.end();
  });

  test("pre-chat, fila e desistência", async ({ page, context }) => {
    await page.goto(baseURL);
    const button = page.getByRole("button", { name: /Atendimento online/ });
    await expect(button).toBeVisible();
    await button.click();

    await page.getByLabel("Nome completo").fill("Rosa Almeida Fontes");
    await page.getByLabel("E-mail ou WhatsApp").fill("rosa.fontes@email.com");
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

    // Segue no mesmo teste: a avaliação precisa da conversa encerrada acima, e
    // cada teste do Playwright nasce com contexto novo — sem o cookie e o
    // localStorage deste, o widget abriria no pré-chat de novo.
    await page.getByLabel("5 estrelas").click();
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    await expect(page.getByText("Como foi o atendimento?")).toHaveCount(0);
    await page.getByRole("button", { name: /Atendimento online/ }).click();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
  });
});
