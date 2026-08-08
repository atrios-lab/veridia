import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFormSchema } from "./publication.ts";

const base = {
  kind: "notice" as const,
  title: "Atendimento em horário reduzido",
  body: "Atendemos até as 12h na sexta-feira.",
};

test("draft without an entry date is accepted", () => {
  const parsed = publicationFormSchema.safeParse(base);
  assert.equal(parsed.success, true);
});

test("publishing without an exit date is refused", () => {
  const parsed = publicationFormSchema.safeParse({
    ...base,
    publishAt: "2026-08-08",
  });
  assert.equal(parsed.success, false);
});

test("exit date before entry date is refused", () => {
  const parsed = publicationFormSchema.safeParse({
    ...base,
    publishAt: "2026-08-08",
    expireAt: "2026-08-01",
  });
  assert.equal(parsed.success, false);
});

test("valid entry and exit dates are accepted", () => {
  const parsed = publicationFormSchema.safeParse({
    ...base,
    publishAt: "2026-08-08",
    expireAt: "2026-08-23",
  });
  assert.equal(parsed.success, true);
});

test("empty title is refused", () => {
  const parsed = publicationFormSchema.safeParse({ ...base, title: "  " });
  assert.equal(parsed.success, false);
});

test("empty body is refused", () => {
  const parsed = publicationFormSchema.safeParse({ ...base, body: "  " });
  assert.equal(parsed.success, false);
});
