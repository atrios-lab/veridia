import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "../tenant/resolve.ts";
import {
  buildCienciaDocument,
  cienciaLine,
  shortText,
} from "./ciencia-document.ts";
import {
  cienciaByKey,
  cienciaState,
  firstSeenAt,
  isOfficeDocumentKind,
  viewedMarks,
  viewKey,
} from "./citizen-view.ts";

const at = (iso: string) => new Date(iso);

test("o que a consulta mostra vira marca de visto, sem repetir e com o valor pelo montante", () => {
  const marks = viewedMarks({
    requirementIds: ["r1", "r1"],
    documentIds: ["d1", "d2", "d1"],
    amountCents: 12000,
    answeredAt: null,
  });
  assert.deepEqual(marks, [
    { target: "requirement", targetId: "r1", action: "viewed" },
    { target: "document", targetId: "d1", action: "viewed" },
    { target: "document", targetId: "d2", action: "viewed" },
    { target: "amount", targetId: "12000", action: "viewed" },
  ]);
  assert.equal(
    viewedMarks({ requirementIds: [], documentIds: [], amountCents: null })
      .length,
    0,
  );
});

test("olho fechado, aberto e baixado; vale a primeira vez", () => {
  const map = cienciaByKey([
    {
      target: "document",
      targetId: "d1",
      action: "viewed",
      firstAt: at("2026-11-16T13:00:00Z"),
      lastAt: at("2026-11-16T15:00:00Z"),
      times: 3,
    },
    {
      target: "document",
      targetId: "d1",
      action: "downloaded",
      firstAt: at("2026-11-16T13:05:00Z"),
      lastAt: at("2026-11-16T13:05:00Z"),
      times: 1,
    },
    {
      target: "requirement",
      targetId: "r1",
      action: "viewed",
      firstAt: at("2026-11-16T12:59:00Z"),
      lastAt: at("2026-11-16T12:59:00Z"),
      times: 1,
    },
  ]);
  const doc = map.get(viewKey("document", "d1"));
  assert.equal(cienciaState(doc), "downloaded");
  assert.equal(doc?.times, 4);
  assert.deepEqual(doc?.lastAt, at("2026-11-16T15:00:00Z"));
  assert.deepEqual(firstSeenAt(doc), at("2026-11-16T13:00:00Z"));
  assert.equal(cienciaState(map.get(viewKey("requirement", "r1"))), "seen");
  assert.equal(cienciaState(map.get(viewKey("amount", "500"))), "unseen");
});

test("aberto pelo link direto, sem a marca de visto, conta como visto", () => {
  const map = cienciaByKey([
    {
      target: "document",
      targetId: "d9",
      action: "downloaded",
      firstAt: at("2026-11-16T10:00:00Z"),
      lastAt: at("2026-11-16T10:00:00Z"),
      times: 1,
    },
  ]);
  assert.deepEqual(
    firstSeenAt(map.get(viewKey("document", "d9"))),
    at("2026-11-16T10:00:00Z"),
  );
});

test("só os arquivos da serventia entram na ciência", () => {
  assert.equal(isOfficeDocumentKind("office"), true);
  assert.equal(isOfficeDocumentKind("rejection-document"), true);
  assert.equal(isOfficeDocumentKind("citizen"), false);
  assert.equal(isOfficeDocumentKind("payment-receipt"), false);
});

test("o comprovante de ciência descreve cada registro em palavras simples", () => {
  assert.equal(
    cienciaLine({
      label: 'Documento "Nota devolutiva nº 01/2026"',
      document: true,
      viewed: "16/11/2026, 10:00",
      opened: "16/11/2026, 10:05",
      ip: "203.0.113.7",
    }),
    '• Documento "Nota devolutiva nº 01/2026": visto pelo requerente em 16/11/2026, 10:00; aberto ou baixado em 16/11/2026, 10:05 (acesso a partir do endereço 203.0.113.7).',
  );
  assert.equal(
    cienciaLine({ label: "Valor do pedido de R$ 10,00", document: false }),
    "• Valor do pedido de R$ 10,00: ainda não visto pelo requerente.",
  );
  assert.equal(shortText("a".repeat(400)).length, 160);
  const document = buildCienciaDocument(TENANTS["cartorio-marinho"], {
    protocolNumber: "PED-2026-000001",
    actName: "Certidão de casamento",
    applicantName: "Fulana de Tal",
    issuedOn: "2026-11-16",
    items: [],
    signee: "Escrevente Exemplo",
  });
  assert.equal(document.title, "Comprovante de ciência");
  assert.match(document.sections[0]?.paragraphs?.[0] ?? "", /Fulana de Tal/);
  assert.match(
    document.sections[1]?.paragraphs?.[0] ?? "",
    /Nada foi disponibilizado/,
  );
});
