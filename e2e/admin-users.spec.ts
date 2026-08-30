import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 9: convite e login. This screen creates real accounts, so every
// test here needs a database and cleans up the row it created: same
// posture as admin-settings.spec.ts.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const CONVIDADA_EMAIL = "julia.e2e@exemplo.com";
const CONVIDADA_EMAIL_NOVO = "julia.e2e.nova@exemplo.com";

test.describe("tela de Usuários", () => {
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

  test.afterEach(async () => {
    // Cascades to the account/session rows via the FKs in auth-schema.ts.
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from "user" where email in (${CONVIDADA_EMAIL}, ${CONVIDADA_EMAIL_NOVO})`;
    await sql.end();
  });

  test("Usuários appears in the sidebar for a registrador", async ({
    page,
  }) => {
    await signIn(page);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Usuários" }),
    ).toBeVisible();
  });

  test("creating an account shows the confirmation, lists the account as waiting, role in Portuguese, and lets it be resent", async ({
    page,
  }) => {
    await signIn(page);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Usuários" })
      .click();
    await expect(page).toHaveURL(`${baseURL}/admin/usuarios`);

    await page.getByLabel("Nome").fill("Júlia E2E");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText("Conta criada. E-mail enviado.")).toBeVisible();

    const row = page.getByText(CONVIDADA_EMAIL).locator("..").locator("..");
    await expect(row.getByText("Aguardando 1º acesso")).toBeVisible();
    await expect(row.getByText("Operador", { exact: true })).toBeVisible();

    // The e-mail has no provider configured in this test run (see
    // playwright.config.ts), so it logs instead of sending: the assertion
    // that matters here is that resending does not error and the account
    // stays in the same "waiting" state, not the log line itself.
    await row.getByRole("button", { name: "Reenviar convite" }).click();
    await expect(row.getByText("Aguardando 1º acesso")).toBeVisible();

    // A duplicate e-mail is refused with a field error, not a crash.
    await page.getByLabel("Nome").fill("Outra Pessoa");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(
      page.getByText("Já existe uma conta com esse e-mail."),
    ).toBeVisible();
  });

  test("renaming an account updates the list", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);
    await page.getByLabel("Nome").fill("Júlia E2E");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Conta criada. E-mail enviado.")).toBeVisible();

    const row = page.getByText(CONVIDADA_EMAIL).locator("..").locator("..");
    await row.getByRole("button", { name: "Atualizar" }).click();

    // Scoped to the dialog: the "Criar conta" form beside it has a field
    // labelled "Nome" too.
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Júlia Renomeada");
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Conta atualizada.")).toBeVisible();
    await expect(row.getByText("Júlia Renomeada")).toBeVisible();
  });

  test("the last active registrador cannot demote itself", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);

    const ownRow = page.getByText(email).locator("..").locator("..");
    await ownRow.getByRole("button", { name: "Atualizar" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Papel").selectOption({ label: "Operador" });
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();

    // The dialog stays open with the reason, and nothing was written.
    await expect(
      dialog.getByText(
        "É preciso manter ao menos um Registrador com acesso ativo.",
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(ownRow.getByText("Registrador")).toBeVisible();
  });

  test("an account that never accessed can be deleted from the row menu", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);
    await page.getByLabel("Nome").fill("Júlia E2E");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Conta criada. E-mail enviado.")).toBeVisible();

    const row = page.getByText(CONVIDADA_EMAIL).locator("..").locator("..");
    const menu = row.getByRole("button", { name: "Mais ações desta conta" });

    // Opens and closes from the keyboard, and gives focus back to the
    // button that opened it.
    await menu.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();

    await menu.click();
    await row.getByRole("button", { name: "Excluir conta" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Ela nunca foi acessada")).toBeVisible();
    await dialog.getByRole("button", { name: "Excluir conta" }).click();

    await expect(page.getByText("Conta excluída.")).toBeVisible();
    await expect(page.getByText(CONVIDADA_EMAIL)).toHaveCount(0);
  });

  test("changing the e-mail waits for confirmation at the new address", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);
    await page.getByLabel("Nome").fill("Júlia E2E");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Conta criada. E-mail enviado.")).toBeVisible();

    const row = page.getByText(CONVIDADA_EMAIL).locator("..").locator("..");
    await row.getByRole("button", { name: "Atualizar" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("E-mail").fill(CONVIDADA_EMAIL_NOVO);
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();

    // The account still answers to the old address, and the list says a
    // change is waiting on someone.
    await expect(row.getByText(CONVIDADA_EMAIL).first()).toBeVisible();
    await expect(
      row.getByText(
        `Troca para ${CONVIDADA_EMAIL_NOVO} aguardando confirmação`,
      ),
    ).toBeVisible();

    const sql = postgres(process.env.DATABASE_URL as string);
    const [pending] = (await sql`
      select split_part(identifier, ':', 2) as token from verification
      where identifier like 'change-email:%'
        and value like (select id from "user" where email = ${CONVIDADA_EMAIL}) || '|%'
    `) as { token: string }[];
    await sql.end();
    expect(pending?.token).toBeTruthy();

    // Whoever confirms may be the person who cannot get in, so the page
    // takes no session.
    await page.context().clearCookies();
    await page.goto(`${baseURL}/admin/confirmar-email?token=${pending.token}`);
    await expect(page.getByText(CONVIDADA_EMAIL_NOVO)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar novo e-mail" }).click();

    await expect(
      page.getByRole("heading", { name: "E-mail alterado" }),
    ).toBeVisible();

    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);
    await expect(page.getByText(CONVIDADA_EMAIL_NOVO)).toBeVisible();
    await expect(page.getByText(CONVIDADA_EMAIL, { exact: true })).toHaveCount(
      0,
    );
  });

  test("a first-access link opens the locked shell with no navigation", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/usuarios`);
    await page.getByLabel("Nome").fill("Júlia E2E");
    await page.getByLabel("E-mail").fill(CONVIDADA_EMAIL);
    await page.getByLabel("Papel").selectOption({ label: "Operador" });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Conta criada. E-mail enviado.")).toBeVisible();

    const sql = postgres(process.env.DATABASE_URL as string);
    const [row] = (await sql`
      select split_part(identifier, ':', 2) as token from verification
      where identifier like 'reset-password:%'
        and value = (select id from "user" where email = ${CONVIDADA_EMAIL})
    `) as { token: string }[];
    await sql.end();
    expect(row?.token).toBeTruthy();
    const token = row.token;

    await page.context().clearCookies();
    await page.goto(`${baseURL}/admin/redefinir-senha?token=${token}`);
    await expect(
      page.getByRole("heading", { name: "Bem-vindo(a), Júlia" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(
      page.getByText("Crie sua senha para liberar o painel."),
    ).toBeVisible();
  });
});
