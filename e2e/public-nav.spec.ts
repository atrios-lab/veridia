import { expect, test } from "@playwright/test";

// The visitor arrives on a phone, where the menu covers the page while it is
// open and is the only thing that can say where they are. No database is
// touched: this is navigation, not filing.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

/** The menu is a popover, closed until the button in the header opens it. */
async function openMenu(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Abrir menu" }).click();
}

test.describe("marcação da página atual", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a página aberta é a única marcada no menu", async ({ page }) => {
    // /solicitar e não /transparencia, que foi a página do relato: aquela lê
    // documentos do banco e não serve sem ele, e o que este teste prova não
    // depende de qual página é.
    await page.goto(`${baseURL}/solicitar`);
    await openMenu(page);

    const menu = page.locator("#site-menu");
    await expect(menu.locator("[aria-current=page]")).toHaveText(
      "Solicitar serviço",
    );
    await expect(menu.locator("[aria-current=page]")).toHaveCount(1);
  });

  test("a marcação acompanha a navegação no cliente", async ({ page }) => {
    await page.goto(`${baseURL}/editais`);
    await openMenu(page);
    const menu = page.locator("#site-menu");
    await expect(menu.locator("[aria-current=page]")).toHaveText("Editais");

    // Sem recarregar: o layout é reaproveitado pelo App Router, e é isso que
    // congelaria a marcação se ela viesse do servidor.
    await menu.getByRole("link", { name: "Ouvidoria" }).click();
    await expect(page).toHaveURL(`${baseURL}/ouvidoria`);

    await openMenu(page);
    await expect(menu.locator("[aria-current=page]")).toHaveText("Ouvidoria");
    await expect(menu.locator("[aria-current=page]")).toHaveCount(1);
  });

  test("uma seção de dois links marca só o endereço aberto", async ({
    page,
  }) => {
    // "Centrais e contato" abre /centrais e /contato: a marcação é por
    // endereço, ou as duas acenderiam juntas.
    await page.goto(`${baseURL}/contato`);
    await openMenu(page);

    const menu = page.locator("#site-menu");
    await expect(menu.locator("[aria-current=page]")).toHaveText("Contato");
    await expect(
      menu.getByRole("link", { name: "Centrais", exact: true }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  test("numa página fora do menu, nada é marcado", async ({ page }) => {
    // A comparação é exata: /privacidade não casa com link nenhum, e nenhum
    // caso especial é necessário para isso.
    await page.goto(`${baseURL}/privacidade`);
    await openMenu(page);

    await expect(page.locator("[aria-current=page]")).toHaveCount(0);
  });
});

test("no desktop o cabeçalho marca a página aberta", async ({ page }) => {
  await page.goto(`${baseURL}/solicitar`);
  const header = page.getByRole("navigation", {
    name: "Navegação principal",
  });
  await expect(header.locator("[aria-current=page]")).toHaveText(
    "Solicitar serviço",
  );
  await expect(header.locator("[aria-current=page]")).toHaveCount(1);
});
