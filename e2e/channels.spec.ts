import { expect, test } from "@playwright/test";
import postgres from "postgres";
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
  // A grade e os horários livres vêm do banco, então a página precisa de um.
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: a grade e os horários livres vêm do banco",
  );

  /**
   * O último dia oferecido, que as próprias reservas da suíte ainda não
   * encheram. Os horários são ocupação real num banco compartilhado, e um
   * teste que usasse sempre o primeiro dia passaria a falhar quando ele
   * lotasse — o que não diz nada sobre o código.
   *
   * Devolve false quando a serventia não tem grade configurada: nesse caso a
   * página mostra o estado "agende pelo telefone", que é o próprio teste
   * abaixo, e não há formulário a exercitar.
   */
  async function openDayWithTimes(page: import("@playwright/test").Page) {
    await page.goto(`${baseURL}/agendar`);
    const days = await page
      .locator("a[href^='/agendar?dia=']")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href") ?? ""),
      );
    if (days.length === 0) return false;
    await page.goto(`${baseURL}${days[days.length - 1]}`);
    return true;
  }

  test("only days the office receives on are offered", async ({ page }) => {
    await page.goto(`${baseURL}/agendar`);
    await expect(
      page.getByRole("heading", { name: "Escolha quando vir à serventia" }),
    ).toBeVisible();

    const days = await page
      .locator("a[href^='/agendar?dia=']")
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")?.slice(-10) ?? ""),
      );

    if (days.length === 0) {
      // Sem grade publicada a página manda ligar, em vez de inventar horários.
      await expect(page.getByText("Agendamento pelo telefone")).toBeVisible();
      return;
    }
    for (const day of days) expect(isBusinessDay(day)).toBe(true);

    // O horário sai marcado na hora: nada de "pedido" nem de protocolo AGD.
    await expect(page.getByText("marcado na hora")).toBeVisible();
    await expect(page.getByText("AGD")).toHaveCount(0);
  });

  /**
   * Tudo o que o formulário exige menos o campo que cada teste quer provar
   * ausente. Serviço e modo são obrigatórios como o horário e o e-mail, então
   * preencher só metade faria todo teste "passar" pelo motivo errado.
   */
  async function fillBooking(
    page: import("@playwright/test").Page,
    omit?: "time" | "email",
  ) {
    if (omit !== "time") await page.getByRole("radio").first().check();
    await page.getByLabel("Do que você precisa").selectOption({ index: 1 });
    await page.getByLabel("Modo de atendimento").selectOption({ index: 1 });
    await page.getByLabel("Nome completo").fill("Antônio Ferreira Lima");
    if (omit !== "email") {
      await page.getByLabel(/E-mail/).fill("antonio@exemplo.com");
    }
    await page.getByLabel("Telefone").fill("(84) 98888-1212");
  }

  test("nothing is booked without a time", async ({ page }) => {
    test.skip(!(await openDayWithTimes(page)), "serventia sem grade publicada");

    await fillBooking(page, "time");
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(page.getByText("Escolha um horário livre")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Agendamento confirmado" }),
    ).toHaveCount(0);
  });

  test("the e-mail is required: it is the only channel", async ({ page }) => {
    test.skip(!(await openDayWithTimes(page)), "serventia sem grade publicada");

    await fillBooking(page, "email");
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(
      page.getByText("Informe um e-mail válido", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Agendamento confirmado" }),
    ).toHaveCount(0);
  });

  test("a booked time is confirmed on the spot and leaves the offer", async ({
    page,
  }) => {
    test.skip(!(await openDayWithTimes(page)), "serventia sem grade publicada");

    const dayUrl = page.url();
    // O primeiro horário livre do dia, e o rótulo dele para conferir depois.
    const chosen = (
      await page
        .getByRole("radio")
        .first()
        .locator("xpath=../span[1]")
        .innerText()
    ).trim();

    await fillBooking(page);
    await page.getByRole("button", { name: "Confirmar agendamento" }).click();

    await expect(
      page.getByRole("heading", { name: "Agendamento confirmado" }),
    ).toBeVisible();
    // Sem protocolo e sem chave: o e-mail é o comprovante.
    await expect(page.getByText(/AGD\.\d{4}\.\d{6}/)).toHaveCount(0);
    await expect(
      page.getByText(/[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/),
    ).toHaveCount(0);
    await expect(page.getByText("antonio@exemplo.com")).toBeVisible();

    // Os chips de dia somem: não há mais nada a escolher.
    await expect(page.locator("a[href^='/agendar?dia=']")).toHaveCount(0);

    const ics = await page.getByRole("button", { name: "Adicionar à agenda" });
    await expect(ics).toBeVisible();

    // E o horário pego sai da oferta daquele dia.
    await page.goto(dayUrl);
    const stillOffered = await page
      .locator("input[name=slotTime]")
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    expect(stillOffered).not.toContain(chosen);
  });

  test("a cancellation link that matches nothing answers neutrally", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/agendar/cancelar?token=nao-existe`);
    await expect(page.getByText("Este link não vale mais")).toBeVisible();
    // Não revela se existe agendamento algum por trás do token.
    await expect(page.getByText(/Cancelar este agendamento\?/)).toHaveCount(0);
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
  test.skip(
    !process.env.DATABASE_URL,
    "precisa de DATABASE_URL: a resposta é gravada no registro",
  );

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

    const sql = postgres(process.env.DATABASE_URL as string);
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
