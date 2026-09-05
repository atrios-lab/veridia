import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { COOKIE_NOTICE_COOKIE } from "../src/app/(public)/_lib/cookie-notice.ts";

// Entrega 8c/8d: o widget do cidadão. A cobertura de janela de horário (a
// diferença entre "auto" e "on") fica em src/core/chat/hours.test.ts, que
// injeta o `Date`; aqui a serventia de teste fica com o chat em "on", que
// ignora o relógio, para este arquivo não depender de que horas são agora
// no momento em que o CI roda (ver SCRUM-23).

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

  // O widget espera o aviso de cookies: os dois moram no canto inferior
  // direito e o chat grava cookie próprio, então ele só é renderizado depois
  // que o cidadão dispensa o aviso (ver (public)/layout.tsx). Sem isto o
  // botão nunca existe.
  test.beforeEach(async ({ context }) => {
    // Por `url` e não por `domain`: o host de teste carrega porta, e o par
    // domínio/caminho escrito à mão erra calado, deixando o cookie de fora.
    await context.addCookies([
      { name: COOKIE_NOTICE_COOKIE, value: "1", url: baseURL },
    ]);
  });

  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    // `availability: "on"` forces the chat open regardless of the office's
    // counterHours, so this suite no longer depends on the wall clock at
    // the moment the CI run happens (see SCRUM-23: the old "auto" setting
    // made the whole block skip itself outside business hours, hiding a
    // real defect for three weeks).
    await sql`
      insert into tenant_content (tenant_slug, key, published, published_at)
      values ('cartorio-marinho', 'office-chat', '{"availability": "on"}'::jsonb, now())
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
    // cada teste do Playwright nasce com contexto novo: sem o cookie e o
    // localStorage deste, o widget abriria no pré-chat de novo.
    await page.getByLabel("5 estrelas").click();
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    await expect(page.getByText("Como foi o atendimento?")).toHaveCount(0);
    await page.getByRole("button", { name: /Atendimento online/ }).click();
    await expect(page.getByLabel("Nome completo")).toBeVisible();
  });
});
