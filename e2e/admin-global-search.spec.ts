import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";

// Busca global (Ctrl K): protocolo e CPF, de qualquer tela do painel.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;
const PROTOCOL = "REQ.2097.000050";
const CPF = "12345678909";

test.describe("Busca global", () => {
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

  // page.goto resolve no "load", antes do useEffect que liga o atalho de
  // teclado (ver shortcut-listener.tsx): logo depois de uma navegação, um
  // único Control+K pode chegar antes de o React anexar o listener e se
  // perder. Repete o atalho até o diálogo abrir.
  async function openSearch(page: Page) {
    const dialog = page.getByRole("dialog", { name: "Busca global" });
    await expect(async () => {
      await page.keyboard.press("Control+K");
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    return dialog;
  }

  test.beforeEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`
      insert into service_requests
        (tenant_slug, kind, protocol_year, protocol_sequence, protocol_number,
         applicant_name, contact, cpf, access_key_hash, status, details)
      values
        ('cartorio-marinho', 'service-request', 2097, 50, ${PROTOCOL},
         'Paulo César Andrade', 'paulo@email.com', ${CPF}, 'hash', 'new', '{}'::jsonb)
      on conflict do nothing
    `;
    await sql.end();
  });

  test.afterEach(async () => {
    const sql = postgres(process.env.DATABASE_URL as string);
    await sql`delete from service_requests where protocol_number = ${PROTOCOL}`;
    await sql.end();
  });

  test("Ctrl K abre a busca em qualquer tela e encontra pelo protocolo", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`${baseURL}/admin/agenda`);

    const dialog = await openSearch(page);

    await page
      .getByPlaceholder(/Buscar protocolo, CPF ou nome/)
      .fill("req 2097 000050");
    const result = dialog.getByText(PROTOCOL);
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(`${baseURL}/admin/pedidos/${PROTOCOL}`);
  });

  test("encontra pelo CPF mascarado", async ({ page }) => {
    await signIn(page);
    const dialog = await openSearch(page);
    await page
      .getByPlaceholder(/Buscar protocolo, CPF ou nome/)
      .fill("123.456.789-09");
    await expect(dialog.getByText(PROTOCOL)).toBeVisible();
  });

  test("termo sem resultado mostra o estado vazio", async ({ page }) => {
    await signIn(page);
    await openSearch(page);
    await page
      .getByPlaceholder(/Buscar protocolo, CPF ou nome/)
      .fill("ninguém com esse nome");
    await expect(page.getByText(/Nada encontrado para/)).toBeVisible();
  });
});
