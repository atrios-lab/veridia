import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { hashAccessKey } from "../src/core/request/access-key.ts";

// Entrega 12: perguntas do pedido, um registro de perguntas e respostas
// anexado ao protocolo, não um chat. Visível na consulta do cidadão e no
// detalhe do pedido no painel. Both suites need a real row, so they skip
// without a database.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

async function seedRequest(protocolNumber: string, accessKey: string) {
  const sql = postgres(process.env.DATABASE_URL as string);
  await sql`
    insert into service_requests
      (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
       act_id, attribution, applicant_name, contact, access_key_hash, status)
    values
      ('cartorio-marinho', 'service-request', 2098,
       ${Number(protocolNumber.split(".")[2])}, ${protocolNumber},
       'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes', 'rosa.fontes@email.com',
       ${hashAccessKey(accessKey)}, 'new')
    on conflict do nothing
  `;
}

async function cleanupRequest(protocolNumber: string) {
  const sql = postgres(process.env.DATABASE_URL as string);
  // service_request_questions cascades from the deleted request.
  await sql`delete from service_requests where protocol_number = ${protocolNumber}`;
}

test.describe("consulta do cidadão: perguntas do pedido", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: o envio de pergunta escreve no banco",
  );

  const PROTOCOL = "REQ.2098.000003";
  const ACCESS_KEY = "TEST-KEYS-0003";

  test.beforeEach(() => seedRequest(PROTOCOL, ACCESS_KEY));
  test.afterEach(() => cleanupRequest(PROTOCOL));

  test("o cidadão vê o card, envia uma pergunta e o selo muda para aguardando resposta", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/protocolo?numero=${PROTOCOL}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();

    await expect(page.getByText("Perguntas sobre este pedido")).toBeVisible();

    await page
      .getByPlaceholder("Escreva sua pergunta…")
      .fill("O documento precisa ser autenticado em cartório?");
    await page.getByRole("button", { name: "Enviar pergunta" }).click();

    await expect(
      page.getByText("O documento precisa ser autenticado em cartório?"),
    ).toBeVisible();
    await expect(page.getByText("Aguardando resposta")).toBeVisible();
  });

  test("uma pergunta em branco é recusada", async ({ page }) => {
    await page.goto(`${baseURL}/protocolo?numero=${PROTOCOL}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();

    await page.getByRole("button", { name: "Enviar pergunta" }).click();
    await expect(page.getByText("Escreva algo antes de enviar.")).toBeVisible();
  });
});

test.describe("painel administrativo: perguntas do cidadão", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.ADMIN_SEED_EMAIL ||
      !process.env.ADMIN_SEED_PASSWORD,
    "precisa de DATABASE_URL, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD: a tela fica atrás do login",
  );

  const email = process.env.ADMIN_SEED_EMAIL as string;
  const password = process.env.ADMIN_SEED_PASSWORD as string;
  const PROTOCOL = "REQ.2098.000004";
  const ACCESS_KEY = "TEST-KEYS-0004";

  async function signIn(page: Page) {
    await page.goto(`${baseURL}/admin/login`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin`);
  }

  test.beforeEach(() => seedRequest(PROTOCOL, ACCESS_KEY));
  test.afterEach(() => cleanupRequest(PROTOCOL));

  test("o operador vê a pergunta, responde, e a resposta chega à consulta do cidadão", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [request] = await sql`
      select id from service_requests where protocol_number = ${PROTOCOL}
    `;
    await sql`
      insert into service_request_questions (tenant_slug, request_id, author_type, body)
      values ('cartorio-marinho', ${request.id}, 'citizen',
              'O documento precisa ser autenticado em cartório?')
    `;

    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`);

    await expect(page.getByText("Perguntas do cidadão")).toBeVisible();
    await expect(
      page.getByText("O documento precisa ser autenticado em cartório?"),
    ).toBeVisible();
    await expect(page.getByText("Aguardando resposta")).toBeVisible();

    await page
      .getByPlaceholder("Responder ao cidadão…")
      .fill("Serve cópia simples, desde que legível.");
    await page.getByRole("button", { name: "Enviar resposta" }).click();

    await expect(
      page.getByText("Resposta enviada. Já aparece na consulta do cidadão."),
    ).toBeVisible();
    await expect(page.getByText("Respondida")).toBeVisible();
    await expect(
      page.getByText("respondeu uma pergunta do cidadão"),
    ).toBeVisible();

    await page.goto(`${baseURL}/protocolo?numero=${PROTOCOL}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Serve cópia simples, desde que legível."),
    ).toBeVisible();
    await expect(page.getByText("Respondida")).toBeVisible();
  });
});
