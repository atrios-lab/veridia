import assert from "node:assert/strict";
import { test } from "node:test";
import { classifySearchTerm } from "./search.ts";

test("a recognisable protocol, even with a loose mask, classifies as protocol", () => {
  const term = classifySearchTerm("sol 2026 000031");
  assert.equal(term.type, "protocol");
  assert.deepEqual(term.type === "protocol" ? term.parsed : undefined, {
    prefix: "SOL",
    year: 2026,
    sequence: 31,
  });
});

test("eleven digits, masked or not, classifies as CPF", () => {
  const masked = classifySearchTerm("123.456.789-09");
  assert.equal(masked.type, "cpf");
  assert.equal(
    masked.type === "cpf" ? masked.digits : undefined,
    "12345678909",
  );

  const bare = classifySearchTerm("12345678909");
  assert.equal(bare.type, "cpf");
});

test("anything else classifies as a name search", () => {
  assert.equal(classifySearchTerm("maria").type, "name");
  assert.equal(classifySearchTerm("maria 123").type, "name");
  assert.equal(classifySearchTerm("").type, "name");
});
