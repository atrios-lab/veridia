import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCents, parseCentsInput } from "./money.ts";

// Intl inserts a non-breaking space between the symbol and the amount, not a
// regular one, so comparisons normalize whitespace rather than spell it out.
const normalizeSpace = (s: string) => s.replace(/\s/g, " ");

test("cents are formatted as Brazilian currency", () => {
  assert.equal(normalizeSpace(formatCents(6210)), "R$ 62,10");
  assert.equal(normalizeSpace(formatCents(38050)), "R$ 380,50");
});

test("typed amounts are read as cents", () => {
  // A comma is the decimal mark; a dot is a thousands separator, as in the
  // pt-BR convention, never the American decimal point.
  assert.equal(parseCentsInput("62,10"), 6210);
  assert.equal(parseCentsInput("1.234,56"), 123456);
  assert.equal(parseCentsInput("62"), 6200);
});

test("a blank, zero or invalid amount is refused", () => {
  assert.equal(parseCentsInput(""), undefined);
  assert.equal(parseCentsInput("   "), undefined);
  assert.equal(parseCentsInput("0"), undefined);
  assert.equal(parseCentsInput("abc"), undefined);
  assert.equal(parseCentsInput("-10"), undefined);
});
