import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getAct } from "@/core/acts/catalog.ts";
import { hashAccessKey } from "@/core/request/access-key.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  closeConversationWith,
  queuePositionWith,
  startConversationWith,
  submitRatingWith,
} from "./chat.ts";
import { createServiceRequestWith } from "./service-request.ts";

// Migrated from e2e/support-chat.spec.ts, "pre-chat, fila e desistência":
// joining the queue, giving up, and rating, without the widget or a cookie
// jar. The httpOnly `chat_token` cookie and the queue-count copy on screen
// are transport and text, not regra; what is regra is what this file checks.

const TENANT = TENANTS["cartorio-marinho"];

let db: Database;
let close: () => Promise<void>;

before(async () => {
  ({ db, close } = await createTestDb());
});

after(async () => {
  await close();
});

test("starting a conversation queues it, and giving up closes it with that reason", async () => {
  const { id } = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Rosa Almeida Fontes",
      contact: "rosa.fontes@email.com",
      subject: "Teste e2e",
      informedProtocolNumber: undefined,
    },
    "/",
  );

  const position = await queuePositionWith(db, TENANT.slug, id);
  assert.equal(position, 1);

  await closeConversationWith(db, TENANT.slug, id, { kind: "citizen" });

  // Closed conversations are not in the queue any more.
  assert.equal(await queuePositionWith(db, TENANT.slug, id), undefined);
});

test("a second citizen joins behind the first", async () => {
  const first = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Primeiro Cidadão",
      contact: "primeiro@email.com",
      subject: "Dúvida",
      informedProtocolNumber: undefined,
    },
    "/",
  );
  const second = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Segundo Cidadão",
      contact: "segundo@email.com",
      subject: "Outra dúvida",
      informedProtocolNumber: undefined,
    },
    "/",
  );

  assert.equal(await queuePositionWith(db, TENANT.slug, first.id), 1);
  assert.equal(await queuePositionWith(db, TENANT.slug, second.id), 2);
});

test("a rating only lands on a conversation that is already closed", async () => {
  const { id } = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Rosa Almeida Fontes",
      contact: "rosa2@email.com",
      subject: "Teste e2e",
      informedProtocolNumber: undefined,
    },
    "/",
  );
  await closeConversationWith(db, TENANT.slug, id, { kind: "citizen" });

  await submitRatingWith(db, TENANT.slug, id, 5, undefined, false);

  const [conversation] = await db.query.chatConversations.findMany({
    where: (table, { eq, and: andOp }) =>
      andOp(eq(table.id, id), eq(table.tenantSlug, TENANT.slug)),
  });
  assert.equal(conversation?.rating, 5);
});

// Migrated from e2e/admin-support-chat.spec.ts, "closing links the
// transcript to an informed protocol": a citizen who names a real protocol
// on the pre-chat form has the conversation matched to it right away.

test("a conversation naming a real protocol is matched to it; a bogus one is not", async () => {
  const act = getAct("rcpn-certidao");
  if (!act) throw new Error("fixture: rcpn-certidao precisa existir");
  const { protocolNumber } = await createServiceRequestWith(db, TENANT, act, {
    applicantName: "Rosa Almeida Fontes",
    contact: "rosa@exemplo.com",
    accessKeyHash: hashAccessKey("chave-chat"),
  });

  const matched = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Rosa Almeida Fontes",
      contact: "rosa@exemplo.com",
      subject: "Dúvida sobre meu pedido",
      informedProtocolNumber: protocolNumber,
    },
    "/",
  );
  assert.equal(matched.matchedProtocolNumber, protocolNumber);

  const notMatched = await startConversationWith(
    db,
    TENANT.slug,
    {
      name: "Outra Pessoa",
      contact: "outra@exemplo.com",
      subject: "Outra dúvida",
      informedProtocolNumber: "REQ.2098.999999",
    },
    "/",
  );
  assert.equal(notMatched.matchedProtocolNumber, undefined);
});
