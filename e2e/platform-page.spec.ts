import { expect, test } from "@playwright/test";

// A página institucional da plataforma e o que o rodapé diz sobre ela. Nada
// aqui grava em banco, então nenhum teste precisa de DATABASE_URL.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("página da plataforma", () => {
  test("abre em qualquer tenant, com o nome da serventia e o Provimento 180", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/plataforma`);
    await expect(
      page.getByRole("heading", {
        name: "Plataforma Eletrônica Oficial da Serventia",
      }),
    ).toBeVisible();
    await expect(page.getByText("Cartório Marinho").first()).toBeVisible();
    await expect(page.getByText(/Provimento CNJ nº 180\/2024/)).toBeVisible();
    // As quatro seções.
    for (const heading of [
      "O que é esta plataforma",
      "Por onde os pedidos entram",
      "Segurança e rastreabilidade",
      "Seus dados",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("a regra de canal está escrita, sem WhatsApp nem e-mail como canal", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/plataforma`);
    const main = page.locator("main");
    await expect(
      main.getByText(/exclusivamente pelas Centrais Oficiais Nacionais/),
    ).toBeVisible();
    await expect(main.getByText(/WhatsApp/)).toHaveCount(0);
    // A página não afirma que o Provimento 7 autoriza a plataforma.
    await expect(main.getByText(/7\/2026/)).toHaveCount(0);
  });

  test("o rodapé nomeia a plataforma e linka a página, sem data-section", async ({
    page,
  }) => {
    await page.goto(baseURL);
    const footer = page.locator("footer");
    await expect(
      footer.getByText(/Plataforma Eletrônica Oficial da Serventia/),
    ).toBeVisible();
    const link = footer.getByRole("link", { name: "Sobre a plataforma" });
    await expect(link).toHaveAttribute("href", "/plataforma");
    await expect(link).not.toHaveAttribute("data-section", /.+/);
    await link.click();
    await expect(page).toHaveURL(/\/plataforma$/);
  });

  test("o wizard de pedido apresenta a plataforma numa linha, sem modal", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/solicitar`);
    await expect(
      page.getByText(/Pedido recebido pela Plataforma Eletrônica Oficial/),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Saiba mais" }),
    ).toHaveAttribute("href", "/plataforma");
  });
});
