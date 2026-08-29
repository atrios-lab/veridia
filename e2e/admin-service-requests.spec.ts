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
         act_id, attribution, applicant_name, contact, access_key_hash, status)
      values
        ('cartorio-marinho', 'service-request', 2098, 1, ${PROTOCOL},
         'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes', 'rosa.fontes@email.com', 'hash', 'new')
      on conflict do nothing
    `;
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number = ${PROTOCOL}`;
    await sql`delete from service_requests where protocol_number like 'REQ.2098.%' and protocol_number != ${PROTOCOL}`;
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
    await expect(page.getByText("Rosa Almeida Fontes")).toBeVisible();

    await page.getByText(PROTOCOL).click();
    await expect(page).toHaveURL(
      `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`,
    );
    await expect(page.getByRole("heading", { name: PROTOCOL })).toBeVisible();
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
    await expect(page.getByText("Aguardando o cidadão")).toBeVisible();
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

  test("printing writes to audit_log; a refused key does not", async ({
    page,
    request,
  }) => {
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
  });
});
