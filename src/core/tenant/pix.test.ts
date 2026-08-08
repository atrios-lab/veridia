import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidPixKey, normalizePixKey } from "./pix.ts";

test("cpf: valid digits pass, formatted input normalizes to digits", () => {
  assert.equal(isValidPixKey("cpf", "529.982.247-25"), true);
  assert.equal(normalizePixKey("cpf", "529.982.247-25"), "52998224725");
});

test("cpf: bad check digit fails", () => {
  assert.equal(isValidPixKey("cpf", "52998224700"), false);
});

test("cnpj: valid digits pass, formatted input normalizes to digits", () => {
  assert.equal(isValidPixKey("cnpj", "11.222.333/0001-81"), true);
  assert.equal(normalizePixKey("cnpj", "11.222.333/0001-81"), "11222333000181");
});

test("cnpj: bad check digit fails", () => {
  assert.equal(isValidPixKey("cnpj", "11222333000180"), false);
});

test("email: valid address passes, normalizes to lower case", () => {
  assert.equal(isValidPixKey("email", "Financeiro@Serventia.Example"), true);
  assert.equal(
    normalizePixKey("email", "Financeiro@Serventia.Example"),
    "financeiro@serventia.example",
  );
});

test("email: missing domain fails", () => {
  assert.equal(isValidPixKey("email", "financeiro.serventia"), false);
});

test("phone: national format normalizes and passes with country code", () => {
  assert.equal(isValidPixKey("phone", "(84) 99999-8888"), true);
  assert.equal(normalizePixKey("phone", "(84) 99999-8888"), "+5584999998888");
});

test("phone: too short fails", () => {
  assert.equal(isValidPixKey("phone", "849999"), false);
});

test("random: uuid passes, normalizes to lower case", () => {
  const uuid = "550E8400-E29B-41D4-A716-446655440000";
  assert.equal(isValidPixKey("random", uuid), true);
  assert.equal(normalizePixKey("random", uuid), uuid.toLowerCase());
});

test("random: not a uuid fails", () => {
  assert.equal(isValidPixKey("random", "not-a-uuid"), false);
});
