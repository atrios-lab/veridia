import assert from "node:assert/strict";
import { test } from "node:test";
import {
  judgeSignedForm,
  readSignedFormCheck,
  waitsOnSignedForm,
} from "./signed-form-check.ts";

const OURS =
  "Registro Civil REQUERIMENTO Protocolo REQ.2026.000148 · 12/11/2026 Do requerimento Termos em que pede deferimento.";

test("requerimento deste protocolo com assinatura digital: segue", () => {
  assert.equal(
    judgeSignedForm({
      mimeType: "application/pdf",
      text: OURS,
      digitallySigned: true,
      protocolNumber: "REQ.2026.000148",
    }).verdict,
    "accepted",
  );
});

test("protocolo quebrado em linhas ainda é reconhecido", () => {
  assert.equal(
    judgeSignedForm({
      mimeType: "application/pdf",
      text: OURS.replace("REQ.2026.000148", "REQ.2026.\n000148"),
      digitallySigned: true,
      protocolNumber: "REQ.2026.000148",
    }).verdict,
    "accepted",
  );
});

test("sem assinatura digital, foto ou escaneado: o cartório confere", () => {
  const base = { protocolNumber: "REQ.2026.000148" };
  assert.equal(
    judgeSignedForm({
      ...base,
      mimeType: "application/pdf",
      text: OURS,
      digitallySigned: false,
    }).verdict,
    "review",
  );
  assert.equal(
    judgeSignedForm({
      ...base,
      mimeType: "image/jpeg",
      text: "",
      digitallySigned: false,
    }).verdict,
    "review",
  );
  assert.equal(
    judgeSignedForm({
      ...base,
      mimeType: "application/pdf",
      text: "   ",
      digitallySigned: false,
    }).verdict,
    "review",
  );
});

test("outro documento ou requerimento de outro protocolo: recusado", () => {
  const other = judgeSignedForm({
    mimeType: "application/pdf",
    text: OURS.replace("000148", "000999"),
    digitallySigned: true,
    protocolNumber: "REQ.2026.000148",
  });
  assert.equal(other.verdict, "wrong");
  assert.match(other.reason, /REQ\.2026\.000999/);
  assert.equal(
    judgeSignedForm({
      mimeType: "application/pdf",
      text: "Carteira de identidade fictícia, documento de exemplo com bastante texto legível.",
      digitallySigned: false,
      protocolNumber: "REQ.2026.000148",
    }).verdict,
    "wrong",
  );
});

test("leitura guardada no pedido", () => {
  assert.equal(readSignedFormCheck({}), null);
  assert.equal(
    readSignedFormCheck({
      signedFormCheck: { verdict: "review", reason: "x", checkedAt: "t" },
    })?.verdict,
    "review",
  );
});

// Fictitious records only (LGPD).
const FILED = new Date("2026-11-09T12:00:00Z");
const SITE = { consents: { lgpd: "2026-11-09T12:00:00Z" } };
const base = {
  status: "new",
  details: SITE as unknown,
  createdAt: FILED,
  consultation: false,
  hasSignedForm: false,
};

test("mesa: pedido do site esperando o requerimento assinado fica fora", () => {
  assert.equal(
    waitsOnSignedForm({ ...base, status: "awaiting-signed-form" }),
    true,
  );
  // Filed before the status existed: still "new", no requerimento.
  assert.equal(waitsOnSignedForm(base), true);
  // The form's own uploads, seconds after filing, are not a new move.
  assert.equal(
    waitsOnSignedForm({
      ...base,
      lastCitizenActivityAt: new Date(FILED.getTime() + 30_000),
    }),
    true,
  );
});

test("mesa: o pedido chega quando o cliente age ou o requerimento precisa de conferência", () => {
  assert.equal(waitsOnSignedForm({ ...base, hasSignedForm: true }), false);
  assert.equal(
    waitsOnSignedForm({
      ...base,
      lastCitizenActivityAt: new Date("2026-11-11T09:00:00Z"),
    }),
    false,
  );
  assert.equal(
    waitsOnSignedForm({
      ...base,
      status: "awaiting-signed-form",
      details: {
        ...SITE,
        signedFormCheck: {
          verdict: "review",
          reason: "Foto",
          checkedAt: "2026-11-10T10:00:00Z",
        },
      },
    }),
    false,
  );
});

test("mesa: balcão, chat, consulta e pedido já em andamento não esperam requerimento", () => {
  assert.equal(
    waitsOnSignedForm({ ...base, details: { channel: "counter" } }),
    false,
  );
  assert.equal(
    waitsOnSignedForm({ ...base, details: { channel: "chat" } }),
    false,
  );
  assert.equal(waitsOnSignedForm({ ...base, consultation: true }), false);
  assert.equal(waitsOnSignedForm({ ...base, status: "in-review" }), false);
});
