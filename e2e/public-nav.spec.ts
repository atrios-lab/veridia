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
  // A página é o link dentro do submenu, com a descrição no mesmo texto.
  await expect(header.locator("[aria-current=page]")).toContainText(
    "Solicitar serviço",
  );
  await expect(header.locator("[aria-current=page]")).toHaveCount(1);
  // Com o submenu fechado, é o botão do grupo que diz onde o visitante está.
  await expect(
    header.getByRole("button", { name: "Serviços" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    header.getByRole("button", { name: "Cidadão" }),
  ).not.toHaveAttribute("aria-current", /./);
});

test.describe("no desktop, Serviços e Cidadão abrem um submenu", () => {
  test("a barra é Início, Serviços, Cidadão, Contato e Transparência", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/`);
    const header = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    // Só o que está na barra: os links dos submenus ficam fechados dentro
    // dos painéis, e o botão de consulta continua sendo o último item.
    await expect(header.locator(":scope > a, :scope > button")).toHaveText([
      "Início",
      "Serviços",
      "Cidadão",
      "Contato",
      "Transparência",
      "Consultar protocolo",
    ]);
  });

  test("o submenu abre, leva à página e fecha sozinho", async ({ page }) => {
    await page.goto(`${baseURL}/`);
    const header = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    const panel = page.locator("#header-menu-cidadao");
    await expect(panel).toBeHidden();

    await header.getByRole("button", { name: "Cidadão" }).click();
    await expect(panel).toBeVisible();
    // Cada página diz o que é: "Ouvidoria" sozinha não conta nada a quem
    // nunca a abriu.
    await expect(
      panel.getByText("Elogio, reclamação, sugestão ou denúncia"),
    ).toBeVisible();

    await panel.getByRole("link", { name: "Ouvidoria" }).click();
    await expect(page).toHaveURL(`${baseURL}/ouvidoria`);
    // Fechado pela navegação: o que o visitante quer é a página, não o menu
    // ainda aberto sobre ela.
    await expect(panel).toBeHidden();
  });

  test("um submenu não repete o que a barra já mostra sozinha", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/`);
    const header = page.getByRole("navigation", {
      name: "Navegação principal",
    });
    // Transparência e Contato pertencem ao grupo "Cidadão" no rodapé e no
    // celular, mas na barra têm link próprio, então saem do submenu.
    await header.getByRole("button", { name: "Cidadão" }).click();
    const panel = page.locator("#header-menu-cidadao");
    await expect(panel.getByRole("link")).toHaveText([
      /Canal LGPD/,
      /Ouvidoria/,
    ]);

    await page.keyboard.press("Escape");
    await header.getByRole("button", { name: "Serviços" }).click();
    await expect(
      page
        .locator("#header-menu-servicos")
        .getByRole("link", { name: "Consultar protocolo" }),
    ).toHaveCount(0);
  });
});

test.describe("no tablet", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("o cabeçalho não estoura a largura da tela", async ({ page }) => {
    // Antes, a barra completa media 807px de conteúdo numa janela de 768px,
    // com "Solicitar serviço" quebrado em duas linhas. Aqui vale o menu do
    // celular.
    await page.goto(`${baseURL}/`);
    await expect(
      page.getByRole("button", { name: "Abrir menu" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
