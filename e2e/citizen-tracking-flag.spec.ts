import { expect, test } from "@playwright/test";
import { encryptOverrides } from "flags";

// A flag "citizen-tracking-v2" (src/flags.ts) decide para onde os links de
// consulta do site apontam. O servidor de teste sobe sem Edge Config, então
// o estado ligado vem do mesmo cookie de override que o Vercel Toolbar
// grava, cifrado com o FLAGS_SECRET que playwright.config.ts fixa nos dois
// lados. Nada aqui toca banco: são links e páginas abertas sem protocolo.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

/** Os três pontos de entrada que o site mesmo desenha, mais o do chat. */
async function lookupHrefs(page: import("@playwright/test").Page) {
  await page.goto(baseURL);
  return {
    header: await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Consultar protocolo" })
      .getAttribute("href"),
    footer: await page
      .locator("footer a[data-section=consulta-protocolo]")
      .getAttribute("href"),
    home: await page.locator("form:has(#numero)").getAttribute("action"),
  };
}

async function turnFlagOn(page: import("@playwright/test").Page) {
  await page.context().addCookies([
    {
      name: "vercel-flag-overrides",
      value: await encryptOverrides({ "citizen-tracking-v2": true }),
      url: baseURL,
    },
  ]);
}

test("desligada, cabeçalho, rodapé e home apontam para /protocolo", async ({
  page,
}) => {
  expect(await lookupHrefs(page)).toEqual({
    header: "/protocolo",
    footer: "/protocolo",
    home: "/protocolo",
  });
});

test("ligada por override, os três apontam para /acompanhar", async ({
  page,
}) => {
  await turnFlagOn(page);
  expect(await lookupHrefs(page)).toEqual({
    header: "/acompanhar",
    footer: "/acompanhar",
    home: "/acompanhar",
  });
});

test("o valor da flag não vai para o navegador, só o link", async ({
  page,
}) => {
  await turnFlagOn(page);
  const response = await page.goto(baseURL);
  expect(await response?.text()).not.toContain("citizen-tracking-v2");
});

test("desligada, /acompanhar continua abrindo por URL direta", async ({
  page,
}) => {
  await page.goto(`${baseURL}/acompanhar`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Veja o andamento",
  );
});

test("ligada, /protocolo continua abrindo por URL direta", async ({ page }) => {
  await turnFlagOn(page);
  await page.goto(`${baseURL}/protocolo`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Consultar protocolo",
  );
});

test("um cookie de override que não abre cai no padrão sem derrubar a página", async ({
  page,
}) => {
  // Cifrado com outro segredo: o que sobra de um preview antigo, ou de
  // outro ambiente, no mesmo navegador. O SDK lança antes de aplicar o
  // defaultValue; é o trackingHref() que segura.
  await page.context().addCookies([
    {
      name: "vercel-flag-overrides",
      value: await encryptOverrides(
        { "citizen-tracking-v2": true },
        "QEdoyLy6GcbApmy58vAMK4OpoaEyCSQM1RpSeRWMZjo",
      ),
      url: baseURL,
    },
  ]);
  const hrefs = await lookupHrefs(page);
  expect(hrefs.header).toBe("/protocolo");
  expect(hrefs.home).toBe("/protocolo");
});
