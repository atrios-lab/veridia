import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 8a/8e: o console do atendente. Conversas são inseridas direto no
// banco (como service-request.test.ts faz para pedidos) em vez de passar
// pelo widget público a cada cenário — mais rápido, e o widget já tem sua
// própria cobertura em support-chat.spec.ts.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const TENANT = "cartorio-marinho";
const SUBJECT = "Teste e2e atendimento";

test("a visitor with no session never reaches the queue", async ({ page }) => {
  await page.goto(`${baseURL}/admin/atendimento`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fatendimento$/);
});

test.describe("console do atendente", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.ADMIN_SEED_EMAIL ||
      !process.env.ADMIN_SEED_PASSWORD,
    "precisa de DATABASE_URL, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD: a tela fica atrás do login",
  );

  const email = process.env.ADMIN_SEED_EMAIL as string;
  const password = process.env.ADMIN_SEED_PASSWORD as string;
  let sessionUserId: string;

  async function signIn(page: Page) {
    await page.goto(`${baseURL}/admin/login`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin`);
  }

  async function insertWaiting(citizenName: string): Promise<string> {
    const sql = postgres(process.env.DATABASE_URL as string);
    const rows = await sql`
      insert into chat_conversations
        (tenant_slug, status, citizen_name, citizen_contact, subject, citizen_token_hash)
      values (${TENANT}, 'waiting', ${citizenName}, 'cidadao@exemplo.com', ${SUBJECT}, ${`hash-${citizenName}`})
      returning id
    `;
    return rows[0].id as string;
  }

  test.beforeAll(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [row] = await sql`select id from "user" where email = ${email}`;
    sessionUserId = row.id as string;
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from chat_messages where tenant_slug = ${TENANT} and conversation_id in (select id from chat_conversations where subject = ${SUBJECT})`;
    await sql`delete from chat_conversations where tenant_slug = ${TENANT} and subject = ${SUBJECT}`;
    await sql`delete from tenant_content where tenant_slug = ${TENANT} and key = 'office-chat'`;
  });

  test("turning the switch on is reflected everywhere immediately", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/atendimento`);

    await expect(
      page.getByText("Indisponível para o chat").first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Indisponível para o chat" })
      .click();
    await expect(
      page.getByText("Disponível para o chat").first(),
    ).toBeVisible();

    // The header pill on a different screen reads the same switch.
    await page.goto(`${baseURL}/admin/pedidos`);
    await expect(page.getByText("Disponível para o chat")).toBeVisible();
  });

  test("the sidebar badge counts conversations waiting", async ({ page }) => {
    await insertWaiting("Rosa Almeida Fontes");
    await insertWaiting("Roberto Alves Lima");

    await signIn(page);
    await page.goto(`${baseURL}/admin/pedidos`);
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: "Atendimento online" }),
    ).toContainText("2");
  });

  test("atender assumes a waiting conversation", async ({ page }) => {
    const id = await insertWaiting("Rosa Almeida Fontes");

    await signIn(page);
    await page.goto(`${baseURL}/admin/atendimento`);
    await page.getByText("Rosa Almeida Fontes").waitFor();
    await page
      .locator("div", { hasText: "Rosa Almeida Fontes" })
      .getByRole("button", { name: "Atender" })
      .click();

    await expect(page).toHaveURL(`${baseURL}/admin/atendimento/${id}`);
    await expect(page.getByText("Rosa Almeida Fontes")).toBeVisible();
  });

  test("a fourth conversation is refused past the limit of three", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const ids = await Promise.all([
      insertWaiting("Cidadão Um"),
      insertWaiting("Cidadão Dois"),
      insertWaiting("Cidadão Três"),
    ]);
    for (const id of ids) {
      await sql`update chat_conversations set status = 'active', assigned_user_id = ${sessionUserId} where id = ${id}`;
    }
    const fourthId = await insertWaiting("Cidadão Quatro");

    await signIn(page);
    await page.goto(`${baseURL}/admin/atendimento`);
    await page
      .locator("div", { hasText: "Cidadão Quatro" })
      .getByRole("button", { name: "Atender" })
      .click();

    await expect(
      page.getByText("Você já está em 3 atendimentos."),
    ).toBeVisible();

    const rows =
      await sql`select status from chat_conversations where id = ${fourthId}`;
    expect(rows[0].status).toBe("waiting");
  });

  test("transferring back to the general queue requires a note", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const id = await insertWaiting("Rosa Almeida Fontes");
    await sql`update chat_conversations set status = 'active', assigned_user_id = ${sessionUserId} where id = ${id}`;

    await signIn(page);
    await page.goto(`${baseURL}/admin/atendimento/${id}`);
    await page.getByRole("button", { name: "Transferir" }).click();

    // Both the button that opened this panel and its own submit button read
    // "Transferir" — scoping to the form is what picks the right one.
    const transferForm = page.locator("form", {
      has: page.getByText("Devolver à fila geral"),
    });
    await transferForm.getByRole("button", { name: "Transferir" }).click();
    await expect(
      page.getByText("A nota interna é obrigatória para transferir."),
    ).toBeVisible();

    await page.getByLabel(/Nota interna/).fill("Motivo do teste e2e.");
    await page.getByText("Devolver à fila geral").click();
    await transferForm.getByRole("button", { name: "Transferir" }).click();

    const rows =
      await sql`select status, assigned_user_id from chat_conversations where id = ${id}`;
    expect(rows[0].status).toBe("waiting");
    expect(rows[0].assigned_user_id).toBe(null);
  });

  test("closing links the transcript to an informed protocol", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [request] = await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         act_id, attribution, applicant_name, contact, access_key_hash)
      values (${TENANT}, 'service-request', 2098, 501, 'REQ.2098.000501',
              'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes', 'rosa@exemplo.com', 'hash')
      returning id
    `;
    const id = await insertWaiting("Rosa Almeida Fontes");
    await sql`
      update chat_conversations
      set status = 'active', assigned_user_id = ${sessionUserId}, matched_request_id = ${request.id}
      where id = ${id}
    `;

    await signIn(page);
    await page.goto(`${baseURL}/admin/atendimento/${id}`);
    await page.getByRole("button", { name: "Encerrar conversa" }).click();
    await page.getByText("Vincular ao pedido localizado no pré-chat").click();
    const closeForm = page.locator("form", {
      has: page.getByText("Vincular ao pedido localizado no pré-chat"),
    });
    await closeForm.getByRole("button", { name: "Encerrar conversa" }).click();

    await expect(page).toHaveURL(`${baseURL}/admin/atendimento`);
    const rows =
      await sql`select status, linked_request_id from chat_conversations where id = ${id}`;
    expect(rows[0].status).toBe("closed");
    expect(rows[0].linked_request_id).toBe(request.id);

    await sql`delete from service_requests where id = ${request.id}`;
  });
});
