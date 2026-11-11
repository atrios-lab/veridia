import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultDeliveryName,
  deliveryLabel,
  deliveryName,
  deliveryNameSuggestions,
  namesForFiles,
  numberedNames,
  sanitizeDeliveryName,
} from "./delivery-name.ts";

test("sem nome, o documento entregue leva o protocolo e o número da entrega", () => {
  assert.equal(
    defaultDeliveryName("REQ.2026.000123", 0),
    "Documento final · REQ.2026.000123",
  );
  assert.equal(
    defaultDeliveryName("REQ.2026.000123", 2),
    "Documento final 3 · REQ.2026.000123",
  );
  assert.equal(
    deliveryName("  ", "REQ.2026.000123", 1),
    "Documento final 2 · REQ.2026.000123",
  );
});

test("o nome digitado é limpo para virar nome de arquivo", () => {
  assert.equal(
    sanitizeDeliveryName(' Certidão  de "inteiro" teor / 2ª via\n'),
    "Certidão de inteiro teor-2ª via",
  );
  assert.equal(sanitizeDeliveryName("x".repeat(150)).length, 100);
  assert.equal(sanitizeDeliveryName("Guia (ITIV/ITBI)"), "Guia (ITIV-ITBI)");
  assert.equal(deliveryName("Traslado", "REQ.2026.000001", 0), "Traslado");
});

test("as sugestões partem do ato e do protocolo, sem repetir", () => {
  const list = deliveryNameSuggestions("REQ.2026.000123", "Certidão");
  assert.equal(list[0], "Certidão · REQ.2026.000123");
  assert.equal(new Set(list).size, list.length);
  assert.ok(list.includes("Guia imobiliária · REQ.2026.000123"));
});

test("as entregas antigas aparecem como Documento final", () => {
  assert.equal(deliveryLabel("documento-final"), "Documento final");
  assert.equal(deliveryLabel("Traslado"), "Traslado");
});

test("um nome para vários arquivos é numerado; um nome por arquivo vale para cada um", () => {
  assert.deepEqual(numberedNames("RG", 3), ["RG", "RG (2)", "RG (3)"]);
  assert.deepEqual(namesForFiles(["RG"], 2), ["RG", "RG (2)"]);
  assert.deepEqual(namesForFiles(["RG", "", "CPF"], 3), [
    "RG",
    undefined,
    "CPF",
  ]);
  assert.deepEqual(namesForFiles([], 2), [undefined, undefined]);
});
