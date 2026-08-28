import { expect, test } from "@playwright/test";

// O destaque da sidebar tem que acompanhar a navegação no cliente: o layout
// que a renderiza é compartilhado por todas as telas do painel, então um
// caminho lido do request ficaria parado no primeiro carregamento e o item
// marcado seria sempre o anterior.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("Sidebar do painel", () => {
  test.skip(
    !process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_PASSWORD,
    "precisa de ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD: a sidebar fica atrás do login",
  );

  test("o item destacado acompanha a navegação, sem recarregar", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/admin/login`);
    await page
      .getByLabel("E-mail")
      .fill(process.env.ADMIN_SEED_EMAIL as string);
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.ADMIN_SEED_PASSWORD as string);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(`${baseURL}/admin`);

    const nav = page.getByRole("navigation");
    const current = nav.locator('a[aria-current="page"]');
    await expect(current).toHaveText(/Visão geral/);

    // Sem page.goto em nenhum passo: é a navegação no cliente que congelava.
    for (const label of ["Pedidos de serviço", "Publicações", "Usuários"]) {
      await nav.getByRole("link", { name: label }).click();
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(new RegExp(label));
    }
  });
});
