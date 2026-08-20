import assert from "node:assert/strict";
import { test } from "node:test";
import { prechatSchema } from "./conversation.ts";

const base = {
  name: "Rosa Almeida Fontes",
  contact: "rosa.fontes@email.com",
  subject: "Andamento de pedido",
};

test("a complete pre-chat is accepted", () => {
  assert.equal(prechatSchema.safeParse(base).success, true);
});

test("name is required", () => {
  assert.equal(prechatSchema.safeParse({ ...base, name: "  " }).success, false);
});

test("subject is required", () => {
  assert.equal(
    prechatSchema.safeParse({ ...base, subject: "" }).success,
    false,
  );
});

test("contact must be a valid e-mail or phone", () => {
  assert.equal(
    prechatSchema.safeParse({ ...base, contact: "não é contato" }).success,
    false,
  );
  assert.equal(
    prechatSchema.safeParse({ ...base, contact: "(84) 99912-0033" }).success,
    true,
  );
});

test("informed protocol number is optional", () => {
  const parsed = prechatSchema.parse(base);
  assert.equal(parsed.informedProtocolNumber, undefined);
});

test("an informed protocol number that matches nothing is still accepted here", () => {
  // Matching it against a real record is src/lib/chat.ts's job: this schema
  // only shapes the input, it never looks anything up.
  const parsed = prechatSchema.safeParse({
    ...base,
    informedProtocolNumber: "REQ.2026.999999",
  });
  assert.equal(parsed.success, true);
});
