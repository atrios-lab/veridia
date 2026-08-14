import assert from "node:assert/strict";
import { test } from "node:test";
import { isEmailContact } from "./form.ts";
import {
  buildQuestionAnsweredEmailText,
  deriveQuestionThreadStatus,
  questionBodySchema,
} from "./question.ts";

test("questionBodySchema trims and collapses whitespace", () => {
  const parsed = questionBodySchema.safeParse("  Precisa   autenticar?  ");
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data, "Precisa autenticar?");
});

test("questionBodySchema rejects blank text", () => {
  const parsed = questionBodySchema.safeParse("   ");
  assert.equal(parsed.success, false);
});

test("questionBodySchema rejects text past the length limit", () => {
  const parsed = questionBodySchema.safeParse("a".repeat(2001));
  assert.equal(parsed.success, false);
});

test("deriveQuestionThreadStatus is none with no messages", () => {
  assert.equal(deriveQuestionThreadStatus([]), "none");
});

test("deriveQuestionThreadStatus is awaiting-reply when the citizen wrote last", () => {
  assert.equal(
    deriveQuestionThreadStatus([
      { authorType: "citizen" },
      { authorType: "staff" },
      { authorType: "citizen" },
    ]),
    "awaiting-reply",
  );
});

test("deriveQuestionThreadStatus is answered when the office wrote last", () => {
  assert.equal(
    deriveQuestionThreadStatus([
      { authorType: "citizen" },
      { authorType: "staff" },
    ]),
    "answered",
  );
});

test("buildQuestionAnsweredEmailText carries the protocol but never a key or a reply", () => {
  const text = buildQuestionAnsweredEmailText({
    protocolNumber: "REQ.2026.000482",
  });
  assert.match(text.subject, /REQ\.2026\.000482/);
  assert.match(text.paragraphs[0], /REQ\.2026\.000482/);
  assert.match(text.footnote, /não traz a chave/i);
  for (const part of [...text.paragraphs, text.footnote]) {
    assert.doesNotMatch(part, /senha|token|chave:/i);
  }
});

test("isEmailContact only accepts e-mail-shaped values", () => {
  assert.equal(isEmailContact("rosa.fontes@email.com"), true);
  assert.equal(isEmailContact(" rosa.fontes@email.com "), true);
  assert.equal(isEmailContact("(84) 99911-2244"), false);
  assert.equal(isEmailContact("84999112244"), false);
});
