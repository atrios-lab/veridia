import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// A conversa dentro da exigência, dos dois lados, e o cumprimento que agora é
// ato do cartório. Mesma disciplina de e2e/admin-service-requests.spec.ts: a
// tela fica atrás do login, então tudo menos o gate de sessão skipa sem banco.
// O banco de dev é o de produção, então a limpeza é por protocolo fixo num ano
// que nenhuma serventia usa.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const TENANT = "cartorio-marinho";
const PROTOCOL = "REQ.2098.000777";

test("a visitor with no session never reaches the request detail", async ({
  page,
}) => {
  await page.goto(`${baseURL}/admin/pedidos`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpedidos$/);
});

test.describe("conversa da exigência", () => {
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

  /** The panel reaches the request by protocol; this is where it lives. */
  const detailUrl = `${baseURL}/admin/pedidos/${encodeURIComponent(PROTOCOL)}`;

  test.beforeEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         act_id, attribution, applicant_name, contact, access_key_hash, status)
      values
        (${TENANT}, 'service-request', 2098, 777, ${PROTOCOL},
         'rcpn-certidao', 'RCPN', 'Rosa Almeida Fontes', '(84) 90000-0000',
         'hash', 'new')
      on conflict do nothing
    `;
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    // Requirements, their messages and their files go by cascade.
    await sql`delete from service_requests where tenant_slug = ${TENANT} and protocol_number = ${PROTOCOL}`;
  });

  test("the office raises a requirement and answers in its conversation", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(detailUrl);

    await page.getByRole("button", { name: "Registrar exigência" }).click();
    await page
      .getByPlaceholder("O que falta para o pedido seguir?")
      .fill("Falta cópia legível do documento de identidade.");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(
      page.getByText("Falta cópia legível do documento de identidade."),
    ).toBeVisible();

    await page
      .getByPlaceholder("Responder ao cidadão...")
      .fill("Serve cópia simples, frente e verso, desde que esteja legível.");
    await page.getByRole("button", { name: "Enviar resposta" }).click();

    await expect(
      page.getByText(
        "Serve cópia simples, frente e verso, desde que esteja legível.",
      ),
    ).toBeVisible();
    // The office spoke last, so nothing is waiting on it.
    await expect(page.getByText("Respondida")).toBeVisible();
  });

  test("only the office closes a requirement, and closing ends the conversation", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [request] =
      await sql`select id from service_requests where tenant_slug = ${TENANT} and protocol_number = ${PROTOCOL}`;
    await sql`
      insert into service_request_requirements (tenant_slug, request_id, text, status)
      values (${TENANT}, ${request.id}, 'Falta o comprovante de residência.', 'pending')
    `;

    await signIn(page);
    await page.goto(detailUrl);
    await expect(page.getByText("Aguardando o cidadão")).toBeVisible();

    await page.getByRole("button", { name: "Marcar como cumprida" }).click();
    // "Cumprida" aparece no selo da exigência e de novo na linha do tempo.
    await expect(page.getByText("Cumprida").first()).toBeVisible();

    // Closed on both sides: no way left to write into it.
    await expect(page.getByPlaceholder("Responder ao cidadão...")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Marcar como cumprida" }),
    ).toHaveCount(0);

    const rows =
      await sql`select status from service_request_requirements where request_id = ${request.id}`;
    expect(rows[0].status).toBe("fulfilled");
  });

  test("a requirement raised by mistake is deleted behind a dialog", async ({
    page,
  }) => {
    const sql = postgres(process.env.DATABASE_URL as string);
    const [request] =
      await sql`select id from service_requests where tenant_slug = ${TENANT} and protocol_number = ${PROTOCOL}`;
    await sql`
      insert into service_request_requirements (tenant_slug, request_id, text, status)
      values (${TENANT}, ${request.id}, 'Exigência lançada por engano.', 'pending')
    `;

    await signIn(page);
    await page.goto(detailUrl);

    await page.getByRole("button", { name: "Excluir" }).first().click();
    await expect(page.getByText("Excluir esta exigência?")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();

    await expect(page.getByText("Exigência lançada por engano.")).toHaveCount(
      0,
    );
    const rows =
      await sql`select id from service_request_requirements where request_id = ${request.id}`;
    expect(rows.length).toBe(0);
  });

  test("the registral andamentos are offered, grouped by phase", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(detailUrl);

    await page.getByText("Corrigir para outro andamento").click();
    const select = page.locator('select[name="statusOverride"]');
    // The vocabulary the registrar actually works in.
    await expect(select.locator('option[value="pre-noted"]')).toHaveCount(1);
    await expect(
      select.locator('option[value="in-qualification"]'),
    ).toHaveCount(1);
    await expect(select.locator("optgroup")).not.toHaveCount(0);

    await select.selectOption("pre-noted");
    await page.getByRole("button", { name: "Aplicar" }).click();
    // "Prenotado" também é o texto da própria opção do select e do resumo:
    // o que interessa aqui é o selo de andamento do pedido.
    await expect(
      page.locator("span").filter({ hasText: /^Prenotado$/ }),
    ).toBeVisible();
  });
});
