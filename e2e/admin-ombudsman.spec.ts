import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { hashAccessKey } from "../src/core/request/access-key.ts";

// Entrega 7c: fila e detalhe de manifestações da ouvidoria.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const IDENTIFIED = "OUV.2098.000001";
const ANONYMOUS = "OUV.2098.000002";
// Identificada, mas alcançável só por telefone: a serventia responde e o
// manifestante lê pela consulta, sem aviso por e-mail. Ver design.md de
// aviso-de-resposta, "O que a verificação alcança".
const BY_PHONE = "OUV.2098.000003";
const ACCESS_KEY = "TEST-OUVK-0001";
const PHONE_ACCESS_KEY = "TEST-OUVK-0003";

/** O andamento atual, no badge. Um `getByText` cru casaria também com a pill
 * de "Mudar para" e com a `<option>` do corrigir, e a locator viraria estrita. */
function badge(page: Page, label: string) {
  return page.locator("span").filter({ hasText: new RegExp(`^${label}$`) });
}

test("a visitor with no session never reaches the queue", async ({ page }) => {
  await page.goto(`${baseURL}/admin/ouvidoria`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fouvidoria$/);
});

test.describe("fila e detalhe de manifestações", () => {
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
         applicant_name, contact, description, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'ombudsman', 2098, 1, ${IDENTIFIED},
         'Cláudia Nogueira Pires', 'claudia.pires@email.com',
         'A senha de atendimento demorou mais de uma hora para ser chamada.',
         ${hashAccessKey(ACCESS_KEY)}, 'new',
         '{"manifestationType":"complaint","anonymous":false,"confidential":false}'::jsonb)
      on conflict do nothing
    `;
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         description, status, details)
      values
        ('cartorio-marinho', 'ombudsman', 2098, 2, ${ANONYMOUS},
         'Poderiam disponibilizar senha eletrônica pelo celular.',
         'new', '{"manifestationType":"suggestion","anonymous":true,"confidential":false}'::jsonb)
      on conflict do nothing
    `;
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, description, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'ombudsman', 2098, 3, ${BY_PHONE},
         'Raimundo Nonato Alves', '(84) 98888-1212',
         'O atendimento por telefone cai antes de alguém atender.',
         ${hashAccessKey(PHONE_ACCESS_KEY)}, 'new',
         '{"manifestationType":"complaint","anonymous":false,"confidential":false}'::jsonb)
      on conflict do nothing
    `;
    await sql.end();
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number like 'OUV.2098.%'`;
    await sql.end();
  });

  test("the queue distinguishes identified from anonymous", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/ouvidoria`);

    const identifiedRow = page.locator("a", { hasText: IDENTIFIED });
    await expect(
      identifiedRow.getByText("Cláudia Nogueira Pires"),
    ).toBeVisible();

    const anonymousRow = page.locator("a", { hasText: ANONYMOUS });
    await expect(anonymousRow.getByText("Anônima")).toBeVisible();
  });

  test("responding to an identified manifestation reaches the citizen's consult", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(IDENTIFIED)}`,
    );
    await expect(page.getByRole("heading", { name: IDENTIFIED })).toBeVisible();

    await page
      .getByPlaceholder(/Escreva a apuração/)
      .fill("Apuramos o ocorrido: reforçamos a escala do balcão.");
    await page
      .getByRole("button", { name: "Enviar resposta e concluir" })
      .click();
    await expect(page.getByText("Resposta enviada")).toBeVisible();

    await page.goto(`${baseURL}/protocolo?numero=${IDENTIFIED}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Apuramos o ocorrido: reforçamos a escala do balcão."),
    ).toBeVisible();
  });

  test("a manifestation reachable only by phone is answered the same way", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(BY_PHONE)}`,
    );

    // Há contato, então o formulário aparece: quem só deixou telefone é
    // respondido igual, e a serventia o alcança pelo telefone que ele deixou.
    await expect(page.getByText("(84) 98888-1212")).toBeVisible();
    await page
      .getByPlaceholder(/Escreva a apuração/)
      .fill("Verificamos a linha e trocamos o aparelho da recepção.");
    await page
      .getByRole("button", { name: "Enviar resposta e concluir" })
      .click();
    await expect(page.getByText("Resposta enviada")).toBeVisible();

    // A resposta chega pela consulta, que é o canal que não depende de e-mail.
    await page.goto(`${baseURL}/protocolo?numero=${BY_PHONE}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(PHONE_ACCESS_KEY);
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Verificamos a linha e trocamos o aparelho da recepção."),
    ).toBeVisible();
  });

  test("an anonymous manifestation with no contact offers no reply form", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(ANONYMOUS)}`,
    );
    await expect(page.getByRole("heading", { name: ANONYMOUS })).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Enviar resposta e concluir" }),
    ).not.toBeVisible();
    await expect(page.getByText(/não há como enviar resposta/)).toBeVisible();

    await page
      .getByPlaceholder("Não é enviada a ninguém.")
      .fill("Repassado à TI para avaliar senha eletrônica pelo celular.");
    await page.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(page.getByText("Anotação salva.")).toBeVisible();
  });

  test("an anonymous manifestation can be closed without a reply", async ({
    page,
  }) => {
    // O relato que originou a tramitação: sem isto a manifestação anônima
    // nasce aberta e conta como pendente para sempre.
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(ANONYMOUS)}`,
    );
    await expect(badge(page, "Recebida")).toBeVisible();

    await page.getByRole("button", { name: "Concluída" }).click();

    await expect(badge(page, "Concluída")).toBeVisible();
    await expect(page.getByText("alterou o andamento")).toBeVisible();
    // A anotação interna continua editável: concluir não é ter respondido.
    await expect(
      page.getByPlaceholder("Não é enviada a ninguém."),
    ).toBeVisible();
    await expect(page.getByText("Resposta enviada")).not.toBeVisible();
  });

  test("a manifestation is filed away and corrected back", async ({ page }) => {
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(ANONYMOUS)}`,
    );

    await page.getByRole("button", { name: "Arquivada" }).click();
    await expect(badge(page, "Arquivada")).toBeVisible();

    // Voltar atrás é caso de uso, não exceção: ver isAllowedOmbudsmanTransition.
    await page.getByText("Corrigir para outro andamento").click();
    await page.getByRole("combobox").selectOption("in-review");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(badge(page, "Em apuração")).toBeVisible();
  });

  test("answering is not an andamento to pick", async ({ page }) => {
    // Marcar "Respondida" sem enviar texto deixaria a consulta do cidadão
    // anunciando uma resposta que não existe.
    await signIn(page);
    await page.goto(
      `${baseURL}/admin/ouvidoria/${encodeURIComponent(ANONYMOUS)}`,
    );

    await expect(
      page.getByRole("button", { name: "Respondida" }),
    ).not.toBeVisible();

    await page.getByText("Corrigir para outro andamento").click();
    await expect(
      page.getByRole("combobox").getByRole("option", { name: "Respondida" }),
    ).toHaveCount(0);
  });
});
