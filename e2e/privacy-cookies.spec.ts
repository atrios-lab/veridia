import { expect, test } from "@playwright/test";

// Política de privacidade e aviso de cookies: nenhum dos dois grava nada em
// banco, então nenhum teste aqui precisa de DATABASE_URL.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.describe("aviso de cookies", () => {
  test("aparece na primeira visita e some ao clicar em Entendi", async ({
    page,
  }) => {
    await page.goto(baseURL);
    await expect(
      page.getByText("Este site usa apenas cookies essenciais"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Entendi" }).click();
    await expect(page.getByRole("button", { name: "Entendi" })).toHaveCount(
      0,
    );
  });

  test("a ciência é lembrada e o aviso não volta depois de recarregar", async ({
    page,
  }) => {
    await page.goto(baseURL);
    await page.getByRole("button", { name: "Entendi" }).click();

    await page.reload();
    await expect(
      page.getByText("Este site usa apenas cookies essenciais"),
    ).toHaveCount(0);
  });
});

test.describe("política de privacidade", () => {
  test("publica o encarregado de dados da própria serventia", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/privacidade`);
    await expect(
      page.getByRole("heading", { name: "Política de Privacidade" }),
    ).toBeVisible();
    await expect(page.getByText("Joelison Alves Marinho")).toBeVisible();
    await expect(
      page.getByText("joelison@cartorioielmomarinhorn.com"),
    ).toBeVisible();
  });
});
