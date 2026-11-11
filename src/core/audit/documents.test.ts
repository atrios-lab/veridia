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

test("na auditoria nada sai em código: alvos em português e uma explicação para leigos", async () => {
  const { targetInWords, auditActionExplanation } = await import("./labels.ts");
  assert.equal(
    targetInWords("tenant-content", "office-role-permissions"),
    "permissões dos cargos",
  );
  assert.equal(
    targetInWords("tenant-content", "office-numbering:guia:2026"),
    "numeração das guias de 2026",
  );
  assert.equal(targetInWords("tenant", "cartorio-marinho"), "");
  assert.equal(
    targetInWords(
      "service-request",
      "f6795be3-79a2-4090-aa30-e56f4e8cb64d · REQ-2026-000123",
    ),
    "REQ-2026-000123",
  );
  assert.equal(
    targetInWords("signed-document", "LTS2ADBH2UKT"),
    "código LTS2-ADBH-2UKT",
  );
  assert.match(
    auditActionExplanation("office-settings.role-permissions"),
    /o que cada cargo pode ver e fazer/,
  );
  assert.match(auditActionExplanation("algo.novo-delete"), /excluído/);
  const doc = buildAuditReportDocument(TENANT, {
    entries: [
      {
        createdAt: new Date("2026-11-11T03:32:00Z"),
        action: "office-settings.role-permissions",
        targetType: "tenant-content",
        targetId: "office-role-permissions",
        actorName: "Maria Exemplo da Silva",
      },
    ],
    issuedAt: new Date("2026-11-11T04:00:00Z"),
    scope: "Registros marcados",
  });
  const text = JSON.stringify(doc);
  assert.ok(!text.includes("office-role-permissions"));
  assert.ok(text.includes("permissões dos cargos"));
  assert.ok(text.includes("O que significa"));
});
