import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { TENANTS } from "../src/core/tenant/resolve.ts";

// The citizen arrives on a phone, so the journey is asserted at 390 wide.
// Everything up to the submit runs with no database, the way the rest of the
// suite does. The write path needs one, so it is skipped where there is none
// and covered by the unit and Postgres tests instead.

const PORT = process.env.PORT ?? "3000";
const marinho = TENANTS["cartorio-marinho"];
const aurora = TENANTS["tabelionato-aurora"];
const baseURL = `http://marinho.localhost:${PORT}`;

test.use({ viewport: { width: 390, height: 844 } });

test("the citizen reaches the form in two taps from the home", async ({
  page,
}) => {
  await page.goto(baseURL);

  // The most frequent task is in the first screen, not five sections down.
  await expect(page.getByPlaceholder("Nº do protocolo")).toBeInViewport();

  await page.getByRole("link", { name: "Solicitar serviço" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Qual serviço você precisa?" }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: /Registro Civil/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Escolha o ato" }),
  ).toBeVisible();

  // The badge is the promise the citizen needs before filling anything in.
  await expect(page.getByText("Só identificação").first()).toBeVisible();
  await expect(page.getByText("On-line + presencial").first()).toBeVisible();

  await page.getByRole("link", { name: /Habilitação de casamento/ }).click();
  await expect(
    page.getByRole("heading", { name: "Preencha o pedido" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  // The act stays in view, with the documents it expects. The checklist
  // exists twice (inline on a phone, sidebar on desktop); the inline one
  // comes first and is the visible one at this width.
  await expect(page.getByText("Certidões de nascimento").first()).toBeVisible();
});

test("the act count on each card is the catalog, not a number in the markup", async ({
  page,
}) => {
  await page.goto(`${baseURL}/solicitar`);
  const civil = page.locator("[data-attribution=RCPN]");
  await expect(civil).toContainText("5 atos");
  await civil.click();
  await expect(page.locator("main a[href*='ato=']")).toHaveCount(5);
});

test("a certificate is never asked what it is for", async ({ page }) => {
  // Lei 6.015 art. 17. The field must not exist on the page at all.
  await page.goto(`${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-certidao`);
  await expect(page.getByLabel("Finalidade")).toHaveCount(0);

  // The search by indicator is one of the two acts that may ask.
  await page.goto(`${baseURL}/solicitar?atribuicao=RI&ato=ri-busca-indicador`);
  await expect(page.getByLabel("Finalidade")).toBeVisible();
});

test("an act from an attribution the office lacks is not served", async ({
  page,
}) => {
  const auroraURL = `http://${aurora.hosts.find((h) => h.endsWith(".localhost"))}:${PORT}`;
  const response = await page.goto(
    `${auroraURL}/solicitar?atribuicao=RI&ato=ri-retificacao`,
  );
  // Not the form: the office does not hold that attribution.
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Preencha o pedido" }),
  ).toHaveCount(0);
});

test("the protocol field carries the number to the lookup", async ({
  page,
}) => {
  await page.goto(baseURL);
  await page.getByPlaceholder("Nº do protocolo").fill("REQ.2026.000148");
  await page.getByRole("button", { name: "Consultar" }).click();
  await expect(page).toHaveURL(/\/protocolo\?numero=REQ\.2026\.000148/);
  await expect(page.getByText("REQ.2026.000148")).toBeVisible();
});

test("an office without the lookup section does not offer the field", async ({
  page,
}) => {
  const auroraURL = `http://${aurora.hosts.find((h) => h.endsWith(".localhost"))}:${PORT}`;
  await page.goto(auroraURL);
  await expect(page.getByPlaceholder("Nº do protocolo")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    aurora.subtitle,
  );
});

test("the office's own theme reaches the page", async ({ page }) => {
  await page.goto(baseURL);
  const themed = page.locator(`[data-theme='${marinho.theme}']`);
  await expect(themed).toHaveCount(1);
  // Structure is shared; the palette is not.
  const auroraURL = `http://${aurora.hosts.find((h) => h.endsWith(".localhost"))}:${PORT}`;
  await page.goto(auroraURL);
  await expect(page.locator(`[data-theme='${aurora.theme}']`)).toHaveCount(1);
  expect(aurora.theme).not.toBe(marinho.theme);
});

test.describe("client-side validation", () => {
  // No database: everything here is refused before a request is made.
  const formURL = `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`;

  test("an invalid CPF is flagged on blur, before any request", async ({
    page,
  }) => {
    await page.goto(formURL);
    let submitted = false;
    page.on("request", (r) => {
      if (r.method() === "POST") submitted = true;
    });
    await page.getByLabel(/CPF/).fill("111.111.111-11");
    await page.getByLabel("Nome completo").click(); // leave the field
    await expect(page.getByText("CPF inválido.")).toBeVisible();
    expect(submitted).toBe(false);
  });

  test("the masks shape CPF and phone as they are typed", async ({ page }) => {
    await page.goto(formURL);
    const cpf = page.getByLabel(/CPF/);
    await cpf.pressSequentially("12345678909");
    await expect(cpf).toHaveValue("123.456.789-09");

    const contact = page.getByLabel(/E-mail ou WhatsApp/);
    await contact.pressSequentially("84990000000");
    await expect(contact).toHaveValue("(84) 99000-0000");

    // The same field takes an e-mail, so letters pass through untouched.
    await contact.fill("");
    await contact.pressSequentially("voce@exemplo.com");
    await expect(contact).toHaveValue("voce@exemplo.com");
  });

  test("submission is blocked next to the missing acceptance", async ({
    page,
  }) => {
    await page.goto(formURL);
    await page.getByLabel("Nome completo").fill("Maria José da Silva");
    await page.getByLabel(/E-mail ou WhatsApp/).fill("(84) 99999-0000");
    await page
      .getByLabel(/Descreva o que você precisa/)
      .fill("Queremos casar em outubro deste ano.");
    await page.getByRole("checkbox").nth(1).check(); // truth only, no LGPD
    await page.getByRole("button", { name: "Enviar requerimento" }).click();

    await expect(
      page.getByText("É necessário autorizar o tratamento", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toHaveCount(0);
  });
});

test.describe("filing a request", () => {
  // The suite runs with no database on purpose (see playwright.config.ts).
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: o envio grava o pedido",
  );

  async function fillForm(page: import("@playwright/test").Page) {
    await page.getByLabel("Nome completo").fill("Maria José da Silva");
    await page.getByLabel(/E-mail ou WhatsApp/).fill("(84) 99999-0000");
    await page
      .getByLabel(/Descreva o que você precisa/)
      .fill("Queremos casar em outubro deste ano.");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("checkbox").nth(1).check();
  }

  test("files travel through the hidden inputs, into and after the request", async ({
    page,
  }) => {
    // Both file inputs are visually hidden (the dashed boxes are the visible
    // controls), so this is the test that they still carry files.
    // 2 MB on purpose: a real photograph is this size, and the server action
    // body cap once rejected anything past 1 MB. A tiny buffer here would
    // leave that regression invisible.
    const fakePdf = {
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.alloc(2 * 1024 * 1024, 0x20),
      ]),
    };

    await page.goto(
      `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`,
    );
    await fillForm(page);
    await page.locator("#anexos").setInputFiles([fakePdf]);
    // The picked file is listed by name, which is what the form shows back.
    await expect(page.getByText("documento.pdf").first()).toBeVisible();
    await page.getByRole("button", { name: "Enviar requerimento" }).click();
    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();

    // Picking the signed form is the send: no separate button to find.
    await page.locator("input[name=requerimento]").setInputFiles([fakePdf]);
    await expect(
      page.getByText("Requerimento assinado recebido", { exact: false }),
    ).toBeVisible();
  });

  test("the request comes back with a protocol and a key shown once", async ({
    page,
  }) => {
    await page.goto(
      `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`,
    );
    await fillForm(page);
    await page.getByRole("button", { name: "Enviar requerimento" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();
    await expect(page.getByText(/REQ\.\d{4}\.\d{6}/)).toBeVisible();
    await expect(
      page.getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/),
    ).toBeVisible();
    await expect(page.getByText("A chave aparece só agora.")).toBeVisible();

    // Reloading must not bring the key back: it exists in that one render.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toHaveCount(0);
  });

  // The old "refused without both acceptances" e2e lived here: the client now
  // blocks that submit before any request, so it moved to the client-side
  // suite above; the server-side refusal stays covered by the unit tests.

  test("the honeypot answers like a success and files nothing", async ({
    page,
    request,
  }) => {
    await page.goto(
      `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`,
    );
    await fillForm(page);
    // Off screen and out of the tab order: only a script fills this.
    await page.locator("input[name=website]").fill("http://spam.exemplo");
    await page.getByRole("button", { name: "Enviar requerimento" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();
    const protocolNumber = await page
      .getByText(/REQ\.\d{4}\.\d{6}/)
      .first()
      .textContent();
    const accessKey = await page
      .getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)
      .first()
      .textContent();

    // Nothing was written, so the pair opens nothing. That is the proof the
    // screen was theatre for the robot.
    const response = await request.post(`${baseURL}/solicitar/requerimento`, {
      form: {
        protocolNumber: protocolNumber ?? "",
        accessKey: accessKey ?? "",
      },
    });
    expect(response.status()).toBe(404);
  });

  test("the signed form is downloadable only with the key", async ({
    page,
    request,
  }) => {
    await page.goto(
      `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`,
    );
    await fillForm(page);
    await page.getByRole("button", { name: "Enviar requerimento" }).click();
    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();

    const protocolNumber =
      (await page
        .getByText(/REQ\.\d{4}\.\d{6}/)
        .first()
        .textContent()) ?? "";
    const accessKey =
      (await page
        .getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)
        .first()
        .textContent()) ?? "";

    const granted = await request.post(`${baseURL}/solicitar/requerimento`, {
      form: { protocolNumber, accessKey },
    });
    expect(granted.status()).toBe(200);
    expect(granted.headers()["content-type"]).toContain("application/pdf");
    expect((await granted.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const refused = await request.post(`${baseURL}/solicitar/requerimento`, {
      form: { protocolNumber, accessKey: "AAAA-BBBB-CCCC" },
    });
    expect(refused.status()).toBe(404);

    // The credential rides in a second file, so the one that gets signed and
    // sent back never holds it. Same route, same gate.
    const receipt = await request.post(`${baseURL}/solicitar/requerimento`, {
      form: { protocolNumber, accessKey, documento: "comprovante" },
    });
    expect(receipt.status()).toBe(200);
    expect(receipt.headers()["content-disposition"]).toContain(
      `comprovante-${protocolNumber}.pdf`,
    );
    expect(granted.headers()["content-disposition"]).toContain(
      `requerimento-${protocolNumber}.pdf`,
    );

    const refusedReceipt = await request.post(
      `${baseURL}/solicitar/requerimento`,
      {
        form: {
          protocolNumber,
          accessKey: "AAAA-BBBB-CCCC",
          documento: "comprovante",
        },
      },
    );
    expect(refusedReceipt.status()).toBe(404);
  });

  test("a pending exigência is answered through the same consult", async ({
    page,
  }) => {
    await page.goto(
      `${baseURL}/solicitar?atribuicao=RCPN&ato=rcpn-habilitacao-casamento`,
    );
    await fillForm(page);
    await page.getByRole("button", { name: "Enviar requerimento" }).click();

    const protocolNumber =
      (await page
        .getByText(/REQ\.\d{4}\.\d{6}/)
        .first()
        .textContent()) ?? "";
    const accessKey =
      (await page
        .getByText(/[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}/)
        .first()
        .textContent()) ?? "";

    // Registering the exigência is the admin panel's job (delivery 6); it is
    // simulated here with a direct write, the same way this suite already
    // simulates the office's own writes elsewhere.
    const sql = neon(process.env.DATABASE_URL as string);
    await sql`
      insert into service_request_requirements (tenant_slug, request_id, text)
      select 'cartorio-marinho', id, 'Falta cópia legível do documento de identidade.'
      from service_requests where protocol_number = ${protocolNumber}
    `;

    await page.goto(`${baseURL}/protocolo`);
    await page.getByLabel("Número do protocolo").fill(protocolNumber);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(accessKey);
    await page.getByRole("button", { name: "Ver detalhes" }).click();

    await expect(page.getByText("Aguardando você")).toBeVisible();
    await expect(
      page.getByText("Falta cópia legível do documento de identidade."),
    ).toBeVisible();

    const fakePdf = {
      name: "resposta.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n"),
    };
    await page.locator("input[name=resposta]").setInputFiles([fakePdf]);

    await expect(page.getByText("Cumprida")).toBeVisible();
    await expect(page.getByText("Aguardando você")).toHaveCount(0);
  });
});
