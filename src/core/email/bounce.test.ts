import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BounceWebhookSchema,
  isPermanentBounce,
  toBounceRecord,
} from "./bounce.ts";

// A real Postmark bounce body, trimmed to the fields that matter here.
const HARD_BOUNCE = {
  RecordType: "Bounce",
  Type: "HardBounce",
  TypeCode: 1,
  Email: "Rosa.Fontes@Email.com",
  From: "nao-responda@cartorioielmomarinhorn.com",
  BouncedAt: "2026-08-25T14:30:05Z",
  Description:
    "The server was unable to deliver your message (ex: unknown user, mailbox not found).",
  Details: "550 5.1.1 The email account that you tried to reach does not exist",
  Inactive: true,
};

test("the kinds that mean the address is gone block, the rest do not", () => {
  for (const kind of ["HardBounce", "BadEmailAddress", "SpamComplaint"]) {
    assert.ok(isPermanentBounce(kind), kind);
  }
  // Everything about today, nothing about the address.
  for (const kind of ["SoftBounce", "Transient", "AutoResponder", "DnsError"]) {
    assert.equal(isPermanentBounce(kind), false, kind);
  }
});

test("an unknown kind lets the message through", () => {
  // Postmark names dozens and adds more. A kind nobody taught this system
  // must not lock a citizen out of the office's only written channel.
  assert.equal(isPermanentBounce("SomethingPostmarkAddedLater"), false);
});

test("a real body parses into the row to store, with the address lowercased", () => {
  const parsed = BounceWebhookSchema.safeParse(HARD_BOUNCE);
  assert.ok(parsed.success);

  const record = toBounceRecord(parsed.data, new Date("2026-08-26T00:00:00Z"));
  assert.equal(record.email, "rosa.fontes@email.com");
  assert.equal(record.kind, "HardBounce");
  assert.ok(record.permanent);
  assert.match(record.detail, /mailbox not found/);
  // The provider's timestamp, not ours: it is when the mail server answered.
  assert.equal(record.occurredAt.toISOString(), "2026-08-25T14:30:05.000Z");
  assert.equal(record.tenantSlug, null);
});

test("without a usable timestamp from the provider, ours is used", () => {
  const now = new Date("2026-08-26T12:00:00Z");
  for (const BouncedAt of [undefined, "nem-parece-uma-data"]) {
    const parsed = BounceWebhookSchema.parse({ ...HARD_BOUNCE, BouncedAt });
    assert.equal(
      toBounceRecord(parsed, now).occurredAt.getTime(),
      now.getTime(),
    );
  }
});

test("a malformed body is refused, so nothing reaches the database", () => {
  for (const body of [
    {},
    { Email: "alguem@exemplo.com" },
    { Type: "HardBounce" },
    { Email: "", Type: "HardBounce" },
    { Email: "alguem@exemplo.com", Type: "   " },
  ]) {
    assert.equal(BounceWebhookSchema.safeParse(body).success, false);
  }
});

test("only the declared fields survive the parse", () => {
  const parsed = BounceWebhookSchema.parse({
    ...HARD_BOUNCE,
    permanent: false,
    tenantSlug: "outra-serventia",
  });
  // The body comes from outside. A field nobody asked for has no route in.
  assert.equal((parsed as Record<string, unknown>).permanent, undefined);
  assert.equal((parsed as Record<string, unknown>).tenantSlug, undefined);
});
