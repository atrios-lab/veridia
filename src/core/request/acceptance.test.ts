import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptanceHash } from "./acceptance.ts";
import type { ExemptionBeneficiary } from "./kinds.ts";

const beneficiary: ExemptionBeneficiary = {
  name: "Maria José da Silva",
  signedBy: "self",
};

const base = {
  tenantSlug: "marinho",
  protocolNumber: "REQ.2026.000295",
  declaredAt: "2026-09-11T09:41:00.000Z",
  actId: "rcpn-certidao",
  certificateType: "sem-busca" as const,
  beneficiaries: [beneficiary],
};

test("o hash é determinístico: o mesmo pedido dá sempre o mesmo hash", () => {
  assert.equal(acceptanceHash(base), acceptanceHash(base));
  // A ordem das chaves no objeto de entrada não deveria importar.
  assert.equal(
    acceptanceHash(base),
    acceptanceHash({
      beneficiaries: base.beneficiaries,
      declaredAt: base.declaredAt,
      protocolNumber: base.protocolNumber,
      tenantSlug: base.tenantSlug,
      actId: base.actId,
      certificateType: base.certificateType,
    }),
  );
});

test("protocolos diferentes com os mesmos beneficiários dão hashes diferentes", () => {
  const other = { ...base, protocolNumber: "REQ.2026.000296" };
  assert.notEqual(acceptanceHash(base), acceptanceHash(other));
});

test("instantes diferentes dão hashes diferentes", () => {
  const other = { ...base, declaredAt: "2026-09-11T09:42:00.000Z" };
  assert.notEqual(acceptanceHash(base), acceptanceHash(other));
});

test("testemunhas não entram no hash: colhidas depois do aceite", () => {
  const withWitnesses: ExemptionBeneficiary = {
    ...beneficiary,
    signedBy: "on-behalf",
    signer: { name: "João da Silva" },
    witnesses: [{ name: "T1" }, { name: "T2" }],
  };
  const withoutWitnesses: ExemptionBeneficiary = {
    ...beneficiary,
    signedBy: "on-behalf",
    signer: { name: "João da Silva" },
  };
  assert.equal(
    acceptanceHash({ ...base, beneficiaries: [withWitnesses] }),
    acceptanceHash({ ...base, beneficiaries: [withoutWitnesses] }),
  );
});

test("hex de 64 caracteres, o formato de um SHA-256", () => {
  assert.match(acceptanceHash(base), /^[0-9a-f]{64}$/);
});
