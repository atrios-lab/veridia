import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "../tenant/resolve.ts";
import { buildSignatureManifest } from "./manifest.ts";
import { LEGAL_VALIDITY_NOTES } from "./policy.ts";

// Fictitious people only (LGPD).
test("o manifesto leva o código e o endereço do documento assinado", () => {
  const doc = buildSignatureManifest(TENANTS["cartorio-marinho"], {
    code: "AB12CD34EF56",
    title: "Certidão de teste",
    originalName: "certidao.pdf",
    pageCount: 1,
    originalSha256: "a".repeat(64),
    signatures: [
      {
        holderName: "MARIA EXEMPLO DA SILVA",
        holderDocument: "52998224725",
        issuerName: "AC Teste",
        serialHex: "0a",
        signedAt: new Date("2026-11-11T12:00:00Z"),
      },
    ],
    verifyUrl: "https://cartorio.exemplo/verificar/AB12CD34EF56",
  });
  const rows = doc.sections[0].rows ?? [];
  assert.deepEqual(rows[0], {
    label: "Código de verificação",
    value: "AB12-CD34-EF56",
  });
  assert.equal(rows[1].value, "cartorio.exemplo/verificar/AB12CD34EF56");
});

test("a base legal cita a plataforma oficial e a ICP-Brasil, cada uma com a fonte", () => {
  const all = LEGAL_VALIDITY_NOTES.map((n) => n.text).join(" ");
  for (const source of [
    "Provimento CNJ nº 180/2024",
    "MP nº 2.200-2/2001",
    "Lei nº 14.063/2020",
    "Lei nº 11.977/2009",
  ]) {
    assert.ok(all.includes(source), source);
  }
});
