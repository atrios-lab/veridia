import assert from "node:assert/strict";
import { test } from "node:test";
import {
  protocolProofLink,
  protocolProofSeal,
  verifyProtocolProofSeal,
} from "./protocol-proof.ts";

const KEY = Buffer.from("chave-de-teste-ficticia");

test("o selo do comprovante compartilhável abre só o seu protocolo", () => {
  const seal = protocolProofSeal(KEY, "cartorio-a", "REQ.2026.000148");
  assert.equal(seal.length, 22);
  assert.ok(
    verifyProtocolProofSeal(KEY, "cartorio-a", "REQ.2026.000148", seal),
  );
  // Another number, another office or a forged seal: nothing.
  assert.equal(
    verifyProtocolProofSeal(KEY, "cartorio-a", "REQ.2026.000149", seal),
    false,
  );
  assert.equal(
    verifyProtocolProofSeal(KEY, "cartorio-b", "REQ.2026.000148", seal),
    false,
  );
  assert.equal(
    verifyProtocolProofSeal(KEY, "cartorio-a", "REQ.2026.000148", "x"),
    false,
  );
});

test("o QR do comprovante compartilhável não leva a chave", () => {
  const link = protocolProofLink(
    "https://cartorio.exemplo",
    "REQ.2026.000148",
    "abc",
  );
  assert.equal(
    link,
    "https://cartorio.exemplo/protocolo/comprovante?numero=REQ.2026.000148&selo=abc",
  );
  assert.equal(link.includes("chave"), false);
});
