import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import { COURSES_TENANT_SLUG } from "@/core/tenant/courses-tenant.ts";
import type { Database } from "@/db/index.ts";
import { demoOutbox } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  demoEmailsAboutWith,
  findDemoEmailWith,
  listDemoEmailsWith,
} from "@/lib/demo-outbox.ts";
import { type OutgoingEmail, sendEmailWith } from "@/lib/email/send.ts";

// The demonstration office's e-mail (change painel-livre-para-alunos): its
// own messages stay in the outbox and never reach the provider; the
// account's messages and every real office's messages go out as before.
// The provider is stood in for by a fetch that records each call.

const DEMO = { slug: COURSES_TENANT_SLUG, demo: true };
const CLIENT = { slug: "cartorio-marinho", demo: false };

let db: Database;
let close: () => Promise<void>;
let calls: string[] = [];
const realFetch = globalThis.fetch;
const realToken = process.env.POSTMARK_SERVER_TOKEN;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

beforeEach(async () => {
  calls = [];
  process.env.POSTMARK_SERVER_TOKEN = "test-token";
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  await db.delete(demoOutbox);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realToken === undefined) delete process.env.POSTMARK_SERVER_TOKEN;
  else process.env.POSTMARK_SERVER_TOKEN = realToken;
});

function email(overrides: Partial<OutgoingEmail>): OutgoingEmail {
  return {
    tenant: DEMO,
    kind: "office",
    to: "maria.real@example.com",
    fromName: "Cartório Vale do Silício",
    subject: "Seu pedido está pronto",
    html: "<p>Seu pedido está pronto.</p>",
    text: "Seu pedido está pronto.",
    ...overrides,
  };
}

test("the demonstration office's own message stays in the outbox", async () => {
  await sendEmailWith(
    db,
    email({ related: { kind: "request", protocol: "2026/000123" } }),
  );
  assert.deepEqual(calls, []);
  const rows = await listDemoEmailsWith(db, COURSES_TENANT_SLUG);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.to, "maria.real@example.com");
  assert.equal(rows[0]?.subject, "Seu pedido está pronto");
  assert.equal(rows[0]?.text, "Seu pedido está pronto.");
  assert.equal(rows[0]?.relatedKind, "request");
  assert.equal(rows[0]?.relatedProtocol, "2026/000123");
});

test("the account's own message goes out from the demonstration office", async () => {
  await sendEmailWith(
    db,
    email({ kind: "account", subject: "Redefina a sua senha" }),
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /postmarkapp/);
  assert.deepEqual(await listDemoEmailsWith(db, COURSES_TENANT_SLUG), []);
});

test("a real office sends its messages as before", async () => {
  await sendEmailWith(db, email({ tenant: CLIENT }));
  assert.equal(calls.length, 1);
  const rows = await db
    .select()
    .from(demoOutbox)
    .where(eq(demoOutbox.tenantSlug, CLIENT.slug));
  assert.deepEqual(rows, []);
});

test("a record's history reads only its own held messages, of its own office", async () => {
  await sendEmailWith(
    db,
    email({ related: { kind: "request", protocol: "2026/000001" } }),
  );
  await sendEmailWith(
    db,
    email({
      subject: "Agendamento confirmado",
      related: { kind: "appointment", protocol: "2026/000001" },
    }),
  );
  await sendEmailWith(
    db,
    email({ related: { kind: "request", protocol: "2026/000002" } }),
  );
  const about = await demoEmailsAboutWith(db, COURSES_TENANT_SLUG, {
    kind: "request",
    protocol: "2026/000001",
  });
  assert.equal(about.length, 1);
  assert.equal(about[0]?.subject, "Seu pedido está pronto");
  assert.deepEqual(
    await demoEmailsAboutWith(db, "cartorio-marinho", {
      kind: "request",
      protocol: "2026/000001",
    }),
    [],
  );
});

test("one held message is found only from its own office", async () => {
  await sendEmailWith(db, email({}));
  const [row] = await listDemoEmailsWith(db, COURSES_TENANT_SLUG);
  assert.ok(row);
  assert.ok(await findDemoEmailWith(db, COURSES_TENANT_SLUG, row.id));
  assert.equal(
    await findDemoEmailWith(db, "cartorio-marinho", row.id),
    undefined,
  );
  assert.equal(
    await findDemoEmailWith(db, COURSES_TENANT_SLUG, randomUUID()),
    undefined,
  );
});
