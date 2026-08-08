import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { isBusinessDay } from "../src/core/scheduling/calendar.ts";

// Agendar, canal LGPD e ouvidoria, on a phone: the three channels of the
// third delivery. Rendering the appointment bands reads the office's own
// occupancy, so those tests need a database and say so; the LGPD and the
// ombudsman forms are refused in the browser before any request, and run
// with none.

const PORT = process.env.PORT ?? "3000";
const baseURL = `http://marinho.localhost:${PORT}`;

test.use({ viewport: { width: 390, height: 844 } });

test.describe("canal LGPD", () => {
  test("the legal term is on the page before anything is sent", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/lgpd`);
    await expect(
      page.getByRole("heading", { name: "Seus dados, seus direitos" }),
    ).toBeVisible();
    await expect(page.getByText("15 dias").first()).toBeInViewport();
    // The right is offered in the holder's own words, with the legal name as
    // the subtitle, not the other way round.
    await expect(
      page.getByText("Ver quais dados vocês têm sobre mim"),
    ).toBeVisible();
    await expect(
      page.getByText("atos registrais têm guarda obrigatória por lei"),
    ).toBeVisible();
  });

  test("the declaration is required, and the refusal costs no round trip", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/lgpd`);
    let submitted = false;
    page.on("request", (r) => {
      if (r.method() === "POST") submitted = true;
    });

    await page.getByRole("radio").first().check();
    await page.getByLabel("Nome completo").fill("Maria José da Silva");
    await page.getByLabel("E-mail").fill("maria@email.com");
    await page
      .getByLabel("Descreva seu pedido")
      .fill("Quero saber quais dados constam do meu cadastro.");
    await page.getByRole("button", { name: "Enviar pedido ao DPO" }).click();

    await expect(
      page.getByText("É necessário declarar que você é o titular", {
        exact: false,
      }),
    ).toBeVisible();
    expect(submitted).toBe(false);
  });

  test("the officer of the office is published, from its own configuration", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/lgpd`);
    await expect(
      page.getByText("Joelison Alves Marinho").first(),
    ).toBeVisible();
  });
});

test.describe("ouvidoria", () => {
  test("the guarantees come before the first field", async ({ page }) => {
    await page.goto(`${baseURL}/ouvidoria`);
    const guarantee = page.getByText("Pode ser anônima", { exact: false });
    await expect(guarantee).toBeInViewport();

    // Before, in the document too: on a phone the sidebar of the desktop
    // would otherwise land below the whole form.
    const order = await page.evaluate(() => {
      const texts = [...document.querySelectorAll("main *")].map(
        (node) => node.textContent ?? "",
      );
      return {
        guarantee: texts.findIndex((t) => t.startsWith("Pode ser anônima")),
        field: texts.indexOf("Tipo de manifestação"),
      };
    });
    expect(order.guarantee).toBeGreaterThanOrEqual(0);
    expect(order.guarantee).toBeLessThan(order.field);
  });

  test("the type is four cards, not a select, and it is required", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/ouvidoria`);
    await expect(page.locator("select")).toHaveCount(0);
    for (const label of ["Elogio", "Reclamação", "Sugestão", "Denúncia"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    await page
      .getByLabel("Sua mensagem")
      .fill("Demora no atendimento do dia 28/07.");
    await page.getByRole("button", { name: "Registrar manifestação" }).click();
    await expect(
      page.getByRole("heading", { name: "Manifestação registrada" }),
    ).toHaveCount(0);
  });
});

test.describe("agendar", () => {
  // Reading which bands are free is a database query, so the page needs one.
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: as faixas vêm da ocupação real",
  );

  /**
   * The last day offered, which the suite's own bookings have not filled.
   * The bands are real occupancy in a shared database, so a test that always
   * used the first day would start failing once it filled up, which says
   * nothing about the code.
   */
  async function openDayWithBands(page: import("@playwright/test").Page) {
    await page.goto(`${baseURL}/agendar`);
    const days = await page
      .locator("a[href^='/agendar?dia=']")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? ""),
      );
    await page.goto(`${baseURL}${days[days.length - 1]}`);
  }

  test("only days the office opens are offered", async ({ page }) => {
    await openDayWithBands(page);
    await expect(
      page.getByRole("heading", { name: "Escolha quando vir à serventia" }),
    ).toBeVisible();

    const days = await page
      .locator("a[href^='/agendar?dia=']")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")?.slice(-10) ?? ""),
      );
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) expect(isBusinessDay(day)).toBe(true);

    // The expectation is set next to the button, where it is being made.
    await expect(page.getByText("Este é um", { exact: false })).toBeVisible();
    await expect(page.getByText("AGD").first()).toBeVisible();
  });

  test("nothing is sent without a band", async ({ page }) => {
    await openDayWithBands(page);
    await page.getByLabel("Nome completo").fill("Antônio Ferreira Lima");
    await page.getByLabel(/E-mail ou WhatsApp/).fill("(84) 98888-1212");
    await page.getByRole("button", { name: "Pedir agendamento" }).click();
    await expect(
      page.getByText("Escolha uma faixa de horário", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pedido de horário enviado" }),
    ).toHaveCount(0);
  });

  test("a filed appointment hands back a protocol and a key, once", async ({
    page,
  }) => {
    await openDayWithBands(page);
    // The first free band of that day.
    await page.getByRole("radio").and(page.locator(":enabled")).first().check();
    await page.getByLabel("Nome completo").fill("Antônio Ferreira Lima");
    await page.getByLabel(/E-mail ou WhatsApp/).fill("(84) 98888-1212");
    await page.getByRole("button", { name: "Pedir agendamento" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido de horário enviado" }),
    ).toBeVisible();
    await expect(page.getByText(/AGD\.\d{4}\.\d{6}/)).toBeVisible();
    await expect(
      page.getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/),
    ).toBeVisible();
    await expect(
      page.getByText("A chave aparece só agora", { exact: false }),
    ).toBeVisible();

    // The day chips and the sidebar are gone: there is nothing left to choose.
    await expect(page.locator("a[href^='/agendar?dia=']")).toHaveCount(0);

    const ics = await page.request.post(`${baseURL}/agendar/agenda`, {
      form: {
        protocolNumber: (
          await page.getByText(/AGD\.\d{4}\.\d{6}/).innerText()
        ).trim(),
        accessKey: (
          await page
            .getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)
            .innerText()
        ).trim(),
      },
    });
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain("BEGIN:VEVENT");
  });
});

test.describe("ouvidoria, gravando", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: o registro é gravado",
  );

  test("an anonymous manifestation gets a number and no key", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/ouvidoria`);
    await page.getByRole("radio").nth(1).check(); // Reclamação
    await page
      .getByLabel("Sua mensagem")
      .fill("Demora no atendimento do dia 28/07, pela manhã.");
    await page.getByRole("button", { name: "Registrar manifestação" }).click();

    await expect(
      page.getByRole("heading", { name: "Manifestação registrada" }),
    ).toBeVisible();
    await expect(page.getByText(/OUV\.\d{4}\.\d{6}/)).toBeVisible();
    await expect(page.getByText("não existe chave")).toBeVisible();
    await expect(page.getByText("CHAVE DE ACESSO")).toHaveCount(0);

    // And it cannot be opened later: without identification there is nothing
    // to protect and nobody to answer.
    const registro = (
      await page.getByText(/OUV\.\d{4}\.\d{6}/).innerText()
    ).trim();
    await page.goto(`${baseURL}/protocolo?numero=${registro}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill("AAAA-BBBB-CCCC");
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(
      page.getByText("Protocolo ou chave de acesso inválidos."),
    ).toBeVisible();
  });

  test("an identified manifestation with secrecy gets a key", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/ouvidoria`);
    await page.getByRole("radio").nth(1).check();
    await page.getByLabel("Sua mensagem").fill("Demora no atendimento.");
    await page.getByLabel(/^Nome/).fill("Maria José da Silva");
    await page.getByLabel(/^Contato/).fill("maria@email.com");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Registrar manifestação" }).click();

    await expect(
      page.getByText("com pedido de sigilo", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByText("CHAVE DE ACESSO")).toBeVisible();
  });
});

test.describe("canal LGPD, gravando", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: o requerimento é gravado",
  );

  test("a filed requirement shows the deadline it has to be answered by", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/lgpd`);
    await page.getByRole("radio").first().check();
    await page.getByLabel("Nome completo").fill("Maria José da Silva");
    await page.getByLabel("E-mail").fill("maria@email.com");
    await page
      .getByLabel("Descreva seu pedido")
      .fill("Quero saber quais dados constam do meu cadastro.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar pedido ao DPO" }).click();

    await expect(
      page.getByRole("heading", { name: "Pedido registrado no canal LGPD" }),
    ).toBeVisible();
    await expect(page.getByText(/SOL\.\d{4}\.\d{6}/)).toBeVisible();
    await expect(
      page.getByText(/Resposta até \d{2}\/\d{2}\/\d{4}/),
    ).toBeVisible();
    await expect(page.getByText("Dia 1 de 15", { exact: false })).toBeVisible();

    const recibo = await page.request.post(`${baseURL}/lgpd/recibo`, {
      form: {
        protocolNumber: (
          await page.getByText(/SOL\.\d{4}\.\d{6}/).innerText()
        ).trim(),
        accessKey: (
          await page
            .getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)
            .innerText()
        ).trim(),
      },
    });
    expect(recibo.status()).toBe(200);
    expect(recibo.headers()["content-type"]).toContain("application/pdf");
  });
});

test.describe("depois da confirmação", () => {
  // The office proposing another band is the admin panel's job (delivery 6).
  // Until it exists, the proposal is written straight into the record, which
  // is what the panel will do, so the citizen's side can be tested today.
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: a proposta é gravada no registro",
  );

  test("the citizen accepts the band the office proposed", async ({ page }) => {
    await page.goto(`${baseURL}/agendar`);
    const days = await page
      .locator("a[href^='/agendar?dia=']")
      .evaluateAll((links) => links.map((l) => l.getAttribute("href") ?? ""));
    await page.goto(`${baseURL}${days[days.length - 1]}`);
    await page.getByRole("radio").and(page.locator(":enabled")).first().check();
    await page.getByLabel("Nome completo").fill("Antônio Ferreira Lima");
    await page.getByLabel(/E-mail ou WhatsApp/).fill("(84) 98888-1212");
    await page.getByRole("button", { name: "Pedir agendamento" }).click();

    const protocolNumber = (
      await page.getByText(/AGD\.\d{4}\.\d{6}/).innerText()
    ).trim();
    const accessKey = (
      await page.getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/).innerText()
    ).trim();

    const sql = neon(process.env.DATABASE_URL as string);
    const proposal = JSON.stringify({
      proposedDate: "2099-08-07",
      proposedSlotHour: 8,
      proposedAt: new Date().toISOString(),
    });
    await sql`update service_requests
              set details = details || ${proposal}::jsonb, status = 'proposed'
              where protocol_number = ${protocolNumber}`;

    await page.goto(`${baseURL}/protocolo?numero=${protocolNumber}`);
    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(accessKey);
    await page.getByRole("button", { name: "Ver detalhes" }).click();

    // The citizen's turn, with both bands side by side.
    await expect(page.getByText("É a sua vez")).toBeVisible();
    await expect(page.getByText("você pediu", { exact: true })).toBeVisible();
    await expect(page.getByText("proposta", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Aceitar/ }).click();
    await expect(page.getByText("Horário confirmado por você")).toBeVisible();
    await expect(page.getByText("É a sua vez")).toHaveCount(0);
  });

  test("the officer's answer is only read with protocol and key", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/lgpd`);
    await page.getByRole("radio").first().check();
    await page.getByLabel("Nome completo").fill("Maria José da Silva");
    await page.getByLabel("E-mail").fill("maria@email.com");
    await page
      .getByLabel("Descreva seu pedido")
      .fill("Quero saber quais dados constam do meu cadastro.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar pedido ao DPO" }).click();

    const protocolNumber = (
      await page.getByText(/SOL\.\d{4}\.\d{6}/).innerText()
    ).trim();
    const accessKey = (
      await page.getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/).innerText()
    ).trim();

    const sql = neon(process.env.DATABASE_URL as string);
    await sql`update service_requests
              set office_reply = 'Seguem os dados que constam do cadastro em seu nome.',
                  office_replied_at = now(), status = 'answered'
              where protocol_number = ${protocolNumber}`;

    // Without the key, the public status says the stage and nothing else.
    await page.goto(`${baseURL}/protocolo?numero=${protocolNumber}`);
    await expect(page.getByText("Seguem os dados que constam")).toHaveCount(0);

    await page.getByPlaceholder("Ex.: BBM8-6XVB-8PUK").fill(accessKey);
    await page.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(page.getByText("Seguem os dados que constam")).toBeVisible();
    await expect(
      page.getByText("nunca a envia por WhatsApp", { exact: false }),
    ).toBeVisible();
  });
});
