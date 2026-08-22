import { expect, test } from "@playwright/test";

// The seal lookup, on a phone. Every test here runs without reaching the TJ:
// the lookup is a guest on somebody else's public system, and a suite that
// hammered it on every push would be both rude and flaky. What needs the TJ
// to answer (a real seal, a real captcha) is verified by hand with
// `pnpm capture:seal`, and its answers are frozen as the fixtures that
// src/lib/seal-lookup.test.ts runs against.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

const OFFICIAL =
  "https://selodigital.tjrn.jus.br/siex/siexnet?visaoId=tjdf.siex.cadastro.consulta.apresentacao.VisaoConsultaPorCodigoNaInternet";

test.use({ viewport: { width: 390, height: 844 } });

test("the page offers the lookup and never hides where it comes from", async ({
  page,
}) => {
  await page.goto(`${baseURL}/selo`);
  await expect(
    page.getByRole("heading", { name: "Consultar selo digital" }),
  ).toBeVisible();
  await expect(page.getByLabel("Código do selo digital")).toBeVisible();
  // The way out is on the page before anything fails, not only after.
  await expect(
    page.getByRole("link", { name: /consulta oficial do Tribunal/ }),
  ).toHaveAttribute("href", OFFICIAL);
});

test("the example code is a shape, not a seal anyone can look up", async ({
  page,
}) => {
  await page.goto(`${baseURL}/selo`);
  const placeholder = await page
    .getByLabel("Código do selo digital")
    .getAttribute("placeholder");
  // A real code resolves to a real act, with the presenter's name and CPF.
  expect(placeholder).not.toMatch(/RN\d{18,}/);
});

test("an empty form is refused in the browser, with no request to the TJ", async ({
  page,
}) => {
  await page.goto(`${baseURL}/selo`);
  let posted = false;
  page.on("request", (r) => {
    if (r.method() === "POST") posted = true;
  });

  await page.getByRole("button", { name: "Consultar selo" }).click();
  await expect(page.getByLabel("Código do selo digital")).toBeFocused();
  expect(posted).toBe(false);
});

test("a lost session asks for a new code instead of failing obscurely", async ({
  page,
  context,
}) => {
  await page.goto(`${baseURL}/selo`);
  await page.getByLabel("Código do selo digital").fill("RN2026000000000000ABC");
  await page.getByPlaceholder("Digite o que está na imagem").fill("abcde");

  // What an expired captcha looks like from the server's side: the session
  // the image belonged to is gone by the time the answer arrives.
  await context.clearCookies();
  await page.getByRole("button", { name: "Consultar selo" }).click();

  // Next's own route announcer is a role="alert" too, so this asks for the
  // message itself rather than for whatever alerts the page happens to have.
  await expect(page.getByText("O código da imagem expirou")).toBeVisible();
  // The typed code survives the refusal: retyping 23 characters because the
  // captcha expired is how someone gives up two keystrokes from the answer.
  await expect(page.getByLabel("Código do selo digital")).toHaveValue(
    "RN2026000000000000ABC",
  );
});

test("asking for a new code fetches another image", async ({ page }) => {
  await page.goto(`${baseURL}/selo`);
  const image = page.getByAltText(/Código de verificação/);
  const before = await image.getAttribute("src");

  await page.getByRole("button", { name: "Gerar novo código" }).click();

  // Same route, new query: each fetch opens its own session on the TJ, and
  // the unique string is also what keeps a CDN from serving a stale image.
  await expect(image).not.toHaveAttribute("src", before ?? "");
});
