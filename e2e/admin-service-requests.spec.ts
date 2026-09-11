import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 6: painel administrativo, fila e detalhe de pedidos de serviço.
// Everything here needs a real session and a real row, so most of the file
// skips without a database and the seeded admin account.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const PROTOCOL = "REQ.2098.000001";

test("a visitor with no session never reaches the queue", async ({ page }) => {
  // No database needed: the middleware turns this away before any check that
  // would touch one.
  await page.goto(`${baseURL}/admin/pedidos`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpedidos$/);
});

test.describe("fila e detalhe de pedidos", () => {
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
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         act_id, attribution, applicant_name, contact, access_key_hash, status,
         details)
      values
        ('cartorio-marinho', 'service-request', 2098, 1, ${PROTOCOL},
         'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes', 'rosa.fontes@email.com', 'hash', 'new',
         '{"phone": "(84) 99912-0033"}'::jsonb)
      on conflict do nothing
    `;
    await sql.end();
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number = ${PROTOCOL}`;
    await sql`delete from service_requests where protocol_number like 'REQ.2098.%' and protocol_number != ${PROTOCOL}`;
    await sql.end();
  });

  test("the queue lists a filed request and links to its detail", async ({
    page,
  }) => {
    await signIn(page);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Pedidos de serviço" })
      .click();
    await expect(page).toHaveURL(`${baseURL}/admin/pedidos`);

    await expect(page.getByText(PROTOCOL)).toBeVisible();
    // O nome do cliente se repete na fila: outros testes protocolam com a
    // mesma pessoa. O que importa é ele estar na linha deste protocolo.
    await expect(
      page
        .getByRole("link", { name: PROTOCOL })
        .getByText("Rosa Almeida Fontes"),
    ).toBeVisible();

    await page.getByText(PROTOCOL).click();
    await expect(page).toHaveURL(
      `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`,
    );
    await expect(page.getByRole("heading", { name: PROTOCOL })).toBeVisible();
  });

  test("the telephone filed with the request reaches the operator", async ({
    page,
  }) => {
    // It rides in "Dados do solicitante", not in a column of its own: this is
    // the test that the reader still finds it there. The section is closed by
    // default, so opening it is part of what the test proves.
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${PROTOCOL}`);
    await page.getByRole("button", { name: "Dados do solicitante" }).click();
    await expect(page.getByText("(84) 99912-0033")).toBeVisible();
  });

  test("changing the andamento is reflected in the queue", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Em análise" }).click();
    // The trail of the move, on the request's own screen, which is also what
    // says the click landed: "Andamento atual:" only shows for a status off
    // the happy path, and this one is on it. The entry used to be keyed by the
    // andamento instead of by the request, so `listRequestHistory` never
    // matched it and the panel showed the change nowhere.
    await expect(
      page.locator("li", { hasText: "mudou o andamento" }),
    ).toBeVisible();

    await page.goto(`${baseURL}/admin/pedidos`);
    const row = page.locator("a", { hasText: PROTOCOL });
    await expect(row.getByText("Em análise")).toBeVisible();
  });

  test("cancelar exige motivo; o motivo aparece no histórico", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    // The pill opens the reason step instead of applying right away.
    await page.getByRole("button", { name: "Cancelado" }).click();
    const reasonField = page.getByLabel(
      "Motivo para mudar o andamento para cancelado",
    );
    await expect(reasonField).toBeVisible();

    // Only spaces passes the browser's `required`, but not the server's trim.
    await reasonField.fill("   ");
    await page.getByRole("button", { name: "Confirmar cancelado" }).click();
    await expect(page.getByText("Escreva o motivo.")).toBeVisible();

    await reasonField.fill("CPF divergente do requerente.");
    await page.getByRole("button", { name: "Confirmar cancelado" }).click();

    await expect(page.getByText("Andamento atual:")).toContainText("Cancelado");
    await expect(
      page.locator("li", { hasText: "mudou o andamento" }),
    ).toContainText("CPF divergente do requerente.");
  });

  test("indeferir com PDF, sem motivo em texto: sucesso e link no histórico", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    // "Indeferido" não é sugestão a partir de "new" (ver kinds.ts): a
    // correção manual é o caminho até ele nesta tela.
    await page.getByRole("button", { name: "Prazo e correção" }).click();
    await page
      .getByLabel("Corrigir para outro andamento")
      .selectOption("rejected");
    await page.getByRole("button", { name: "Aplicar" }).click();

    const reasonField = page.getByLabel(
      "Motivo para mudar o andamento para indeferido",
    );
    await expect(reasonField).toBeVisible();

    const fakePdf = {
      name: "indeferimento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.alloc(1024, 0x20),
      ]),
    };
    await page.setInputFiles('input[name="rejectionDocument"]', fakePdf);
    await expect(page.getByText("indeferimento.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Confirmar indeferido" }).click();

    await expect(page.getByText("Andamento atual:")).toContainText(
      "Indeferido",
    );
    await expect(
      page.locator("li", { hasText: "mudou o andamento" }),
    ).toContainText("Ver documento do indeferimento");
  });

  test("indeferir sem motivo em texto e sem PDF é recusado", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Prazo e correção" }).click();
    await page
      .getByLabel("Corrigir para outro andamento")
      .selectOption("rejected");
    await page.getByRole("button", { name: "Aplicar" }).click();

    const reasonField = page.getByLabel(
      "Motivo para mudar o andamento para indeferido",
    );
    await expect(reasonField).toBeVisible();
    await page.getByRole("button", { name: "Confirmar indeferido" }).click();

    await expect(
      page.getByText("Escreva o motivo ou anexe um documento."),
    ).toBeVisible();
    // The confirmation stays open on error, not the andamento a success
    // would have shown: proof nothing moved.
    await expect(reasonField).toBeVisible();
  });

  test("o prazo salva sozinho, sem mudar o andamento", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Prazo e correção" }).click();
    await page.getByRole("radio", { name: "Mudar para" }).check();
    await page.getByLabel("Dias de prazo").fill("12");
    await page.getByRole("button", { name: "Salvar prazo" }).click();

    // O prazo novo vale sem que o andamento tenha mudado, e sobrevive ao
    // recarregar: era isso que a serventia perdia a cada F5.
    await expect(
      page.getByText(/^Prazo até .* · 12 dias úteis$/),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText(/^Prazo até .* · 12 dias úteis$/),
    ).toBeVisible();
    await expect(
      page.locator("li", { hasText: "ajustou o prazo" }),
    ).toBeVisible();
  });

  test("a value can be informed and then removed", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Informar valor" }).click();
    await page.getByPlaceholder("0,00").fill("62,10");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Valor atual: R$ 62,10")).toBeVisible();

    await page.getByRole("button", { name: "Remover valor" }).click();
    await expect(page.getByText("Ainda não informado")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remover valor" }),
    ).toHaveCount(0);
  });

  test("a comprovante the citizen sent shows in the queue and the detail's suggestion", async ({
    page,
  }) => {
    // The citizen reporting a payment is /protocolo's own job (see
    // service-request.spec.ts); simulated here the same way the exigência
    // test above simulates the office's writes, with the andamento already at
    // "Pagamento informado" and its comprovante already attached.
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      update service_requests set status = 'payment-reported', amount_cents = 25000
      where tenant_slug = 'cartorio-marinho' and protocol_number = ${PROTOCOL}
    `;
    await sql`
      insert into service_request_attachments
        (tenant_slug, request_id, kind, stored_name, display_name, path, mime_type, size_bytes)
      select 'cartorio-marinho', id, 'payment-receipt', 'comprovante.pdf', 'Comprovante de pagamento', 'comprovante.pdf', 'application/pdf', 1024
      from service_requests where protocol_number = ${PROTOCOL}
    `;
    await sql.end();

    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos`);
    await expect(
      page.locator("a", { hasText: PROTOCOL }).getByText("Pagamento informado"),
    ).toBeVisible();

    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);
    await expect(page.getByText(/Pagamento informado em/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ver comprovante" }),
    ).toBeVisible();
    // "Pago" is the suggested next step from "Pagamento informado".
    await expect(page.getByRole("button", { name: "Pago" })).toBeVisible();
  });

  test("a registered requirement appears right away", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Registrar exigência" }).click();
    await page
      .getByPlaceholder("O que falta para o pedido seguir?")
      .fill("Falta cópia legível do documento de identidade.");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();

    await expect(
      page.getByText("Falta cópia legível do documento de identidade."),
    ).toBeVisible();
    // Exact: the deadline badge in the header now says "Aguardando o cidadão
    // desde hoje" for the same reason, and this line is about the card.
    await expect(
      page.getByText("Aguardando o cidadão", { exact: true }),
    ).toBeVisible();
  });

  test("uma exigência cadastrada suspende o prazo; cumpri-la recomeça a contagem", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await page.getByRole("button", { name: "Registrar exigência" }).click();
    await page
      .getByPlaceholder("O que falta para o pedido seguir?")
      .fill("Falta a certidão anterior.");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();

    // O selo troca de tom: não é atraso da serventia, é espera pelo cidadão,
    // e o resumo do prazo diz desde quando está parado.
    await expect(
      page.getByText("Aguardando o cidadão desde hoje"),
    ).toBeVisible();
    await expect(page.getByText(/^Prazo suspenso desde/)).toBeVisible();
    await expect(
      page.locator("li", { hasText: "suspendeu o prazo" }),
    ).toBeVisible();

    // Certidão do RCPN tem prazo legal (5 dias, Lei 6.015 art. 19): cumprida a
    // exigência, a contagem recomeça hoje em vez de continuar de onde parou.
    await page.getByRole("button", { name: "Marcar como cumprida" }).click();
    await expect(page.getByText(/^Prazo até .* · 5 dias úteis$/)).toBeVisible();
    await page.getByRole("button", { name: "Prazo e correção" }).click();
    await expect(
      page.getByText(/^Hoje: até .* · 5 dias úteis, a contar do próximo/),
    ).toBeVisible();
    await expect(page.getByText("Aguardando o cidadão desde hoje")).toHaveCount(
      0,
    );
    await expect(
      page.locator("li", { hasText: "retomou o prazo" }),
    ).toBeVisible();
  });

  test("launching a manual request generates a protocol and a key", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/novo`);

    await page.getByLabel("Nome do solicitante").fill("João Pedro Nascimento");
    await page.getByLabel("E-mail ou WhatsApp").fill("(84) 99912-0033");
    await page.getByRole("button", { name: "Registrar pedido" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();
    await expect(page.getByText(/REQ\.\d{4}\.\d{6}/)).toBeVisible();
    await expect(
      page.getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/),
    ).toBeVisible();
  });

  test("a rejected launch keeps what was typed; fixing it and resending succeeds", async ({
    page,
  }) => {
    // React resets an uncontrolled form once the action resolves. Without the
    // action echoing back what it received, the operator would lose every
    // field that was right just to fix the one that wasn't.
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/novo`);

    await page.getByLabel("Nome do solicitante").fill("Marta Andrade Lopes");
    await page.getByLabel("E-mail ou WhatsApp").fill("marta.lopes@email.com");
    // Repeated digits pass no checksum and are never issued: a value the
    // server always refuses, on purpose.
    await page.getByLabel("CPF (opcional)").fill("111.111.111-11");
    await page.getByRole("button", { name: "Registrar pedido" }).click();

    await expect(page.getByText("Confira os campos destacados.")).toBeVisible();
    // What was typed survives the failed submit, in every field.
    await expect(page.getByLabel("Nome do solicitante")).toHaveValue(
      "Marta Andrade Lopes",
    );
    await expect(page.getByLabel("E-mail ou WhatsApp")).toHaveValue(
      "marta.lopes@email.com",
    );
    await expect(page.getByLabel("CPF (opcional)")).toHaveValue(
      "111.111.111-11",
    );

    await page.getByLabel("CPF (opcional)").fill("529.982.247-25");
    await page.getByRole("button", { name: "Registrar pedido" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();
    await expect(page.getByText("Marta Andrade Lopes")).toBeVisible();
  });

  test("printing writes to audit_log; a refused key does not", async ({
    page,
  }) => {
    // page.request, never the `request` fixture: that one is a separate
    // context with its own empty cookie jar, so the middleware sees no
    // session and redirects to the login, which Playwright follows into a
    // 200 that never touched the route being tested.
    const request = page.request;
    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    const sql = postgres(process.env.DATABASE_URL as string);
    const auditCount = async (action: string) => {
      const [row] = await sql`
        select count(*)::int as n from audit_log
        where action = ${action}
          and target_id = (select id::text from service_requests where protocol_number = ${PROTOCOL})
      `;
      return row.n as number;
    };

    const before = await auditCount("service-request.print.requerimento");
    const sheet = await request.get(
      `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}/imprimir`,
    );
    expect(sheet.status()).toBe(200);
    expect(await auditCount("service-request.print.requerimento")).toBe(
      before + 1,
    );

    // A fresh key, so the receipt below has one that actually verifies.
    await page.getByRole("button", { name: "Emitir nova chave" }).click();
    await page.getByRole("button", { name: "Confirmar emissão" }).click();
    const accessKey =
      (await page
        .getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)
        .first()
        .textContent()) ?? "";

    const beforeReceipt = await auditCount("service-request.print.comprovante");
    const refused = await request.post(
      `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}/imprimir`,
      { form: { chave: "AAAA-BBBB-CCCC" } },
    );
    expect(refused.status()).not.toBe(200);
    expect(await auditCount("service-request.print.comprovante")).toBe(
      beforeReceipt,
    );

    const receipt = await request.post(
      `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}/imprimir`,
      { form: { chave: accessKey } },
    );
    expect(receipt.status()).toBe(200);
    expect(await auditCount("service-request.print.comprovante")).toBe(
      beforeReceipt + 1,
    );
    await sql.end();
  });
});
