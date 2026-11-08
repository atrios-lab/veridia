import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import { buildAppointmentReceipt } from "./receipt.ts";
import { BASE_CHECKLIST, getCounterService } from "./services.ts";

const tenant = {
  name: "Cartório Exemplo",
  subtitle: "Ofício Único",
  address: "Rua das Flores, 10, Centro",
  contacts: { phone: "(84) 3000-0000", email: "cartorio@exemplo.com" },
  cns: "123456",
  legalFooter: "Serventia extrajudicial",
} as unknown as Tenant;

test("the receipt carries the time to arrive and what to bring", () => {
  const service = getCounterService("rcpn.habilitacao-casamento");
  assert.ok(service);
  const receipt = buildAppointmentReceipt(tenant, {
    protocolNumber: "AGD.2026.000007",
    agenda: "geral",
    date: "2026-11-10",
    slotTime: "09:00",
    citizenName: "Maria Souza",
    cpf: "12345678909",
    phone: "(84) 99999-0000",
    email: "maria@exemplo.com",
    mode: "Presencial",
    serviceDetails: null,
    service,
    createdAt: new Date("2026-11-08T12:00:00Z"),
  });

  assert.equal(receipt.title, "Comprovante de agendamento");
  // The office's CNS goes on the letterhead, next to its contacts.
  assert.ok(receipt.office.some((line) => line.startsWith("CNS nº 123456")));
  assert.match(receipt.subtitle, /AGD\.2026\.000007/);
  assert.equal(receipt.eyebrow, "Atendimento do cartório");
  const when = receipt.sections[0];
  assert.deepEqual(
    when.rows?.find((row) => row.label === "Chegada")?.value,
    "Até 08:45 (15 minutos antes)",
  );
  assert.equal(
    receipt.sections
      .find((section) => section.heading === "Quem vai ser atendido")
      ?.rows?.find((row) => row.label === "CPF")?.value,
    "123.456.789-09",
  );

  const bring = receipt.sections.find((s) => s.heading === "O que trazer");
  const lines = bring?.paragraphs ?? [];
  // The base list first, then the service's own, then its note.
  assert.equal(lines[0], `[  ] ${BASE_CHECKLIST[0]}`);
  assert.ok(lines.some((line) => line.includes("Duas testemunhas")));
  assert.ok(lines.includes(service.note ?? ""));
  // Doubts about a document go to the office's e-mail before the visit.
  assert.match(lines.at(-1) ?? "", /enviá-lo para cartorio@exemplo\.com/);
  // Right under the time, so it never lands on a second page.
  assert.equal(receipt.sections[1].heading, "Antes de vir");
  assert.match(
    receipt.sections[1].paragraphs?.[0] ?? "",
    /15 minutos de antecedência, às 08:45/,
  );
});

test("a receipt for the notary's agenda says so", () => {
  const receipt = buildAppointmentReceipt(tenant, {
    protocolNumber: null,
    agenda: "tabeliao",
    date: "2026-11-10",
    slotTime: "14:00",
    citizenName: "João",
    cpf: null,
    phone: "",
    email: "",
    mode: "Presencial",
    serviceDetails: "Escritura da casa",
    service: { label: "Serviço que sumiu", bring: [] },
    createdAt: new Date("2026-11-08T12:00:00Z"),
  });
  assert.equal(receipt.eyebrow, "Atendimento com o tabelião");
  assert.ok(receipt.sections.some((s) => s.heading === "O que você informou"));
  // A service no longer configured still prints the base list.
  const bring = receipt.sections.find((s) => s.heading === "O que trazer");
  // Base items, the caveat and the e-mail for doubts.
  assert.equal(bring?.paragraphs?.length, BASE_CHECKLIST.length + 2);
});

test("a receipt for a phone call has no arrival and says to be ready", () => {
  const receipt = buildAppointmentReceipt(tenant, {
    protocolNumber: "AGD.2026.000009",
    agenda: "tabeliao",
    date: "2026-11-11",
    slotTime: "14:00",
    citizenName: "Ana",
    cpf: null,
    phone: "(84) 99999-0000",
    email: "",
    mode: "Por ligação",
    serviceDetails: null,
    service: { label: "Procuração pública", bring: [] },
    createdAt: new Date("2026-11-08T12:00:00Z"),
  });
  const when = receipt.sections[0].rows ?? [];
  assert.equal(
    when.find((row) => row.label === "Chegada"),
    undefined,
  );
  assert.equal(
    when.find((row) => row.label === "Atendimento")?.value,
    "Por ligação",
  );
  assert.match(receipt.sections[1].paragraphs?.[0] ?? "", /liga no telefone/);
  assert.ok(receipt.sections.some((s) => s.heading === "O que ter em mãos"));
});

test("the receipt points to the office's own list when there is one", () => {
  const receipt = buildAppointmentReceipt(tenant, {
    protocolNumber: "AGD.2026.000010",
    agenda: "geral",
    date: "2026-11-10",
    slotTime: "09:00",
    citizenName: "Ana",
    cpf: null,
    phone: "",
    email: "",
    mode: "Presencial",
    serviceDetails: null,
    service: {
      label: "Autenticação de cópias",
      bring: ["Os documentos originais"],
      checklist: ["Documentos originais", "Taxa paga no caixa"],
    },
    checklistUrl: "https://cartorio.exemplo/agendar/lista/notas.autenticacao",
    createdAt: new Date("2026-11-08T12:00:00Z"),
  });
  const lines =
    receipt.sections.find((s) => s.heading === "O que trazer")?.paragraphs ??
    [];
  assert.deepEqual(lines.slice(0, 2), [
    "[  ] Documentos originais",
    "[  ] Taxa paga no caixa",
  ]);
  assert.ok(
    lines.some((line) => line.endsWith("/agendar/lista/notas.autenticacao")),
  );
});
