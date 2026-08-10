import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationFormSchema } from "./publication.ts";

// The sectors this imaginary office's attributions allow. The factory is what
// enforces them; the form's hidden options are a courtesy.
const schema = publicationFormSchema(["proclamas", "protesto"]);

const base = {
  kind: "notice" as const,
  title: "Atendimento em horário reduzido",
  body: "Atendemos até as 12h na sexta-feira.",
};

test("draft without an entry date is accepted", () => {
  const parsed = schema.safeParse(base);
  assert.equal(parsed.success, true);
});

test("publishing without an exit date is refused", () => {
  const parsed = schema.safeParse({
    ...base,
    publishAt: "2026-08-08",
  });
  assert.equal(parsed.success, false);
});

test("exit date before entry date is refused", () => {
  const parsed = schema.safeParse({
    ...base,
    publishAt: "2026-08-08",
    expireAt: "2026-08-01",
  });
  assert.equal(parsed.success, false);
});

test("valid entry and exit dates are accepted", () => {
  const parsed = schema.safeParse({
    ...base,
    publishAt: "2026-08-08",
    expireAt: "2026-08-23",
  });
  assert.equal(parsed.success, true);
});

test("empty title is refused", () => {
  const parsed = schema.safeParse({ ...base, title: "  " });
  assert.equal(parsed.success, false);
});

test("empty body is refused", () => {
  const parsed = schema.safeParse({ ...base, body: "  " });
  assert.equal(parsed.success, false);
});

test("banns always land in the proclamas sector, unasked", () => {
  const parsed = schema.safeParse({
    ...base,
    kind: "marriageBanns" as const,
    // Even a crafted POST saying otherwise is overruled.
    sector: "protesto" as const,
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.sector, "proclamas");
});

test("a notice never carries a sector", () => {
  const parsed = schema.safeParse({ ...base, sector: "protesto" as const });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.sector, null);
});

test("an edital must say which sector it belongs to", () => {
  const parsed = schema.safeParse({ ...base, kind: "publicNotice" as const });
  assert.equal(parsed.success, false);
});

test("an edital cannot claim a sector the office's attributions lack", () => {
  const parsed = schema.safeParse({
    ...base,
    kind: "publicNotice" as const,
    sector: "rtd" as const,
  });
  assert.equal(parsed.success, false);

  const allowed = schema.safeParse({
    ...base,
    kind: "publicNotice" as const,
    sector: "protesto" as const,
  });
  assert.equal(allowed.success, true);
  assert.equal(allowed.data?.sector, "protesto");
});
