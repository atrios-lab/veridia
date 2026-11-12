import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeSignedForm, readSignedFormCheck } from "./signed-form-check.ts";

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
