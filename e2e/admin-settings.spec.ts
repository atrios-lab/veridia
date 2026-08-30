import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Entrega 4: painel administrativo, aba Serventia. Everything here needs a
// real session and a real row, so the whole file skips without a database:
// the screen is behind the panel guard and its point is that what it saves
// reaches the public site.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("configurações: aba Serventia", () => {
  // Serial: every test in here writes and clears the one override row for the
  // pilot office. In parallel they read each other's half-finished edits, and
  // the failure looks like a bug in the screen instead of in the fixture.
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

  // Each test leaves the office as it found it: the override row is what the
  // public site serves, so a test that forgets it changes the next one.
  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-contact'`;
  });

  test("what the office saves is what the public site serves", async ({
    page,
  }) => {
    await signIn(page);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Configurações" })
      .click();
    await expect(page).toHaveURL(`${baseURL}/admin/configuracoes`);

    const novoTelefone = "(84) 4042-0999";
    // A tela tem mais de um formulário, cada um com seu "Salvar". O clique
    // precisa ser no que contém o campo alterado.
    const contato = page
      .locator("form")
      .filter({ has: page.getByLabel("Telefone") });
    await contato.getByLabel("Telefone").fill(novoTelefone);
    await contato.getByRole("button", { name: "Salvar" }).click();
    await expect(
      page.getByText("Salvo. Já está valendo no site."),
    ).toBeVisible();

    // The reload proves it was persisted, not just echoed back.
    await page.reload();
    await expect(page.getByLabel("Telefone")).toHaveValue(novoTelefone);

    // O telefone não fica mais na home: o redesign levou o contato para a
    // página própria, que é onde o site serve o que a serventia salvou.
    await page.goto(`${baseURL}/contato`);
    await expect(
      page.getByText(novoTelefone).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("an invalid e-mail is refused and nothing is saved", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes`);

    const contato = page
      .locator("form")
      .filter({ has: page.getByLabel("Telefone") });
    const telefoneOriginal = await page.getByLabel("Telefone").inputValue();
    await page.getByLabel("Telefone").fill("(84) 4042-0111");
    // Deliberately an address the browser's own type="email" check waves
    // through: the point of this test is the server refusing it, and a value
    // the browser blocks would never reach the server to be refused.
    await page.getByLabel("E-mail").fill("contato@exemplo");
    await contato.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Confira os campos destacados.")).toBeVisible();
    // What was typed survives the failed submit.
    await expect(page.getByLabel("Telefone")).toHaveValue("(84) 4042-0111");

    // And the office is still serving the value it had before.
    await page.goto(`${baseURL}/admin/configuracoes`);
    await expect(page.getByLabel("Telefone")).toHaveValue(telefoneOriginal);
  });

  test("attributions are stated, never offered as a control", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes`);

    // All six are listed, each with its state in words rather than in colour
    // and shape alone. The pilot office holds all six.
    for (const label of ["RCPN", "Notas", "RI", "Protesto", "RTD", "RCPJ"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Delegada", { exact: true })).toHaveCount(6);
    await expect(page.getByText("Não delegada", { exact: true })).toHaveCount(
      0,
    );

    await expect(
      page.getByText("A atribuição é uma delegação do tribunal"),
    ).toBeVisible();
    await expect(page.getByText("Somente leitura")).toBeVisible();

    // Nothing in this block is a control. This is the regression guard: the
    // switches used to be here, and the first person to see them clicked.
    const block = page.locator("section").filter({
      hasText: "Atribuições da serventia",
    });
    await expect(block.locator("input, button, [role='switch']")).toHaveCount(
      0,
    );

    // Nome and CNS are printed, and neither is an input anyone can type in.
    await expect(
      page.locator('input[name="name"], input[name="cns"]'),
    ).toHaveCount(0);
  });

  test("the four tabs all navigate", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes`);

    await page.getByRole("tab", { name: "Cobrança" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin/configuracoes/cobranca`);
    await page.getByRole("tab", { name: "Encarregado" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin/configuracoes/encarregado`);
    await page.getByRole("tab", { name: "Serventia" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin/configuracoes`);
  });
});

test.describe("configurações, aba Encarregado", () => {
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
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-dpo'`;
  });

  test("what the office saves reaches the LGPD page", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/encarregado`);

    const novoNome = "Pessoa Encarregada de Teste";
    const novoEmail = "dpo-teste@serventia.example";
    await page.getByLabel("Nome").fill(novoNome);
    await page.getByLabel("E-mail de contato").fill(novoEmail);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(
      page.getByText("Encarregado atualizado. Já reflete no site."),
    ).toBeVisible();

    await page.goto(`${baseURL}/lgpd`);
    // O nome e o e-mail aparecem em mais de um bloco, e um deles fica oculto
    // no layout atual: a asserção precisa do primeiro que está visível.
    await expect(
      page.getByText(novoNome).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(novoEmail).filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test("an invalid e-mail is refused and nothing is saved", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/encarregado`);

    const nomeOriginal = await page.getByLabel("Nome").inputValue();
    await page.getByLabel("Nome").fill("Outra Pessoa");
    // Com @: o campo é type="email", e um valor sem @ o navegador barra
    // antes de chegar ao servidor, que é quem este teste quer ver recusando.
    await page.getByLabel("E-mail de contato").fill("dpo@serventia");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Confira os campos destacados.")).toBeVisible();
    await expect(page.getByLabel("Nome")).toHaveValue("Outra Pessoa");

    await page.goto(`${baseURL}/admin/configuracoes/encarregado`);
    await expect(page.getByLabel("Nome")).toHaveValue(nomeOriginal);
  });
});

test.describe("configurações, aba Cobrança", () => {
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
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from tenant_content where tenant_slug = 'cartorio-marinho' and key = 'office-pix'`;
  });

  test("a valid key is saved and can be removed", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/cobranca`);

    await page.getByLabel("Tipo da chave").selectOption("email");
    // Sem `exact`, "Chave" também casaria com o rótulo "Tipo da chave".
    await page
      .getByLabel("Chave", { exact: true })
      .fill("financeiro@serventia.example");
    await page.getByLabel("Cidade").fill("Marinho");
    await page.getByRole("button", { name: "Salvar chave" }).click();
    await expect(
      page.getByText("Salvo. Já está valendo no site."),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Chave", { exact: true })).toHaveValue(
      "financeiro@serventia.example",
    );

    await page.getByRole("button", { name: "Remover chave" }).click();
    await expect(
      page.getByText("Remover a chave Pix da serventia?"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar remoção" }).click();
    // Sem esperar a confirmação, o reload corre contra a ação e a página
    // volta a ser renderizada com a chave ainda no banco.
    await expect(page.getByText("Chave Pix removida.")).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Sem chave, a consulta de protocolo não mostra QR Code"),
    ).toBeVisible();
  });

  test("a key that does not match its type is refused", async ({ page }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/configuracoes/cobranca`);

    await page.getByLabel("Tipo da chave").selectOption("email");
    await page
      .getByLabel("Chave", { exact: true })
      .fill("financeiro.serventia");
    await page.getByRole("button", { name: "Salvar chave" }).click();

    await expect(page.getByText("Confira os campos destacados.")).toBeVisible();
  });
});

test("a visitor with no session never reaches the settings screen", async ({
  page,
}) => {
  // No database needed: the middleware turns this away before any check that
  // would touch one.
  await page.goto(`${baseURL}/admin/configuracoes`);
  await expect(page).toHaveURL(
    /\/admin\/login\?next=%2Fadmin%2Fconfiguracoes$/,
  );
});

test.describe("uma serventia com atribuição não delegada", () => {
  // The pilot office holds all six attributions, so nothing above ever
  // renders "Não delegada". Aurora holds only NOTAS: its own seeded account,
  // separate from the pilot's, is what makes the other five states real
  // instead of only present in the component's code.
  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.AURORA_ADMIN_EMAIL ||
      !process.env.AURORA_ADMIN_PASSWORD,
    "precisa de DATABASE_URL, AURORA_ADMIN_EMAIL e AURORA_ADMIN_PASSWORD: " +
      "pnpm db:seed com ADMIN_SEED_TENANT=tabelionato-aurora cria essa conta",
  );

  test("attributions the office was never delegated read as such, and cannot be turned on", async ({
    page,
  }) => {
    const auroraURL = `http://aurora.localhost:${PORT}`;
    await page.goto(`${auroraURL}/admin/login`);
    await page
      .getByLabel("E-mail")
      .fill(process.env.AURORA_ADMIN_EMAIL as string);
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.AURORA_ADMIN_PASSWORD as string);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${auroraURL}/admin`);

    await page.goto(`${auroraURL}/admin/configuracoes`);
    await expect(page.getByText("Delegada", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Não delegada", { exact: true })).toHaveCount(
      5,
    );

    // The hollow marker and dimmed row read "não delegada" without relying on
    // colour, and there is still nothing in the block to click. The card, not
    // any ancestor: RCPN and "Não delegada" both appear in wider containers
    // too, which is what a plain div filter would also match.
    const rcpn = page.locator(".rounded-\\[10px\\]").filter({
      hasText: "RCPN",
    });
    await expect(rcpn).toContainText("Não delegada");
    const block = page.locator("section").filter({
      hasText: "Atribuições da serventia",
    });
    await expect(block.locator("input, button, [role='switch']")).toHaveCount(
      0,
    );
  });
});
