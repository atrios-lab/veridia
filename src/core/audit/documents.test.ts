import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "../tenant/resolve.ts";
import {
  buildAuditReportDocument,
  buildNotificationDocument,
  paragraphsOf,
} from "./documents.ts";
import { auditActionLabel, DEFAULT_LEGAL_BASIS } from "./labels.ts";

// Fictitious people only (LGPD).
const TENANT = TENANTS["cartorio-marinho"];
const entries = [
  {
    createdAt: new Date("2026-11-10T13:00:00Z"),
    action: "request.status",
    targetType: "service-request",
    targetId: "2026-000123",
    actorName: "João Fictício de Souza",
  },
];

const text = (doc: ReturnType<typeof buildNotificationDocument>) =>
  JSON.stringify(doc);

test("a notificação traz número, pessoa, atos, fundamentação e as 24 horas", () => {
  const doc = buildNotificationDocument(TENANT, {
    year: 2026,
    sequence: 7,
    subject: "Esclarecimentos sobre atos registrados no painel",
    facts: "Mudança de situação do pedido.",
    legalBasis: DEFAULT_LEGAL_BASIS,
    targetName: "João Fictício de Souza",
    targetRoleLabel: "Escrevente",
    deadlineAt: new Date("2026-11-12T12:00:00Z"),
    issuedAt: new Date("2026-11-11T12:00:00Z"),
    entries,
    holderName: "Maria Exemplo da Silva",
    holderTitle: "Tabeliã",
  });
  assert.equal(doc.title, "Notificação nº 007/2026");
  const all = text(doc);
  for (const piece of [
    "João Fictício de Souza",
    "Escrevente",
    "2026-000123",
    "8.935",
    "24 horas",
    "Auditoria",
    "Maria Exemplo da Silva",
  ]) {
    assert.ok(all.includes(piece), piece);
  }
  assert.match(doc.dateLine ?? "", /11 de novembro de 2026/);
});

test("o relatório lista cada registro em palavras", () => {
  const doc = buildAuditReportDocument(TENANT, {
    entries,
    issuedAt: new Date("2026-11-11T12:00:00Z"),
    scope: "Registros marcados",
  });
  assert.ok(JSON.stringify(doc).includes(auditActionLabel("request.status")));
});

test("o nome de cada ação nunca fica em branco", () => {
  assert.notEqual(auditActionLabel("request.status"), "");
  assert.equal(auditActionLabel("algo.desconhecido"), "algo.desconhecido");
  assert.match(DEFAULT_LEGAL_BASIS, /LV/);
  assert.match(DEFAULT_LEGAL_BASIS, /LGPD|13\.709/);
});

test("texto digitado no formulário (CRLF) vira um parágrafo por linha, sem caractere estranho", () => {
  assert.deepEqual(paragraphsOf("Primeiro.\r\n\r\nSegundo.\r\nTerceiro.\n"), [
    "Primeiro.",
    "Segundo.",
    "Terceiro.",
  ]);
});
