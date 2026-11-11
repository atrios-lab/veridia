import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  findMessageFileWith,
  inboxWith,
  listAllConversationsWith,
  listContactsWith,
  listMessagesWith,
  MessageError,
  openDirectWith,
  sendMessageWith,
  touchPresenceWith,
  updateProfileWith,
} from "./messages.ts";

let db: Database;
let close: () => Promise<void>;
// Fictitious people only (LGPD).
const OFFICE = "cartorio-marinho";

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: "titular",
      name: "Maria Exemplo da Silva",
      email: "maria.msg@exemplo.com",
      tenantSlug: OFFICE,
      role: "admin",
    },
    {
      id: "escrevente",
      name: "João Fictício de Souza",
      email: "joao.msg@exemplo.com",
      tenantSlug: OFFICE,
      role: "staff",
    },
    {
      id: "auxiliar",
      name: "Ana Modelo Pereira",
      email: "ana.msg@exemplo.com",
      tenantSlug: OFFICE,
      role: "auxiliar",
    },
    {
      id: "de-fora",
      name: "Pedro Teste",
      email: "pedro.msg@exemplo.com",
      tenantSlug: "cartorio-exemplo",
      role: "staff",
    },
  ]);
});
after(async () => {
  await close();
});

test("conversa direta: uma por dupla, só entre gente da mesma serventia", async () => {
  const a = await openDirectWith(db, OFFICE, "escrevente", "auxiliar");
  const b = await openDirectWith(db, OFFICE, "auxiliar", "escrevente");
  assert.equal(a, b);
  await assert.rejects(
    openDirectWith(db, OFFICE, "escrevente", "de-fora"),
    MessageError,
  );
  await assert.rejects(
    openDirectWith(db, OFFICE, "escrevente", "escrevente"),
    MessageError,
  );
});

test("mensagens, não lidas, chamar atenção com intervalo, e o titular lê tudo", async () => {
  const id = await openDirectWith(db, OFFICE, "escrevente", "auxiliar");
  const t0 = new Date("2026-11-11T12:00:00Z");
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "escrevente",
    { kind: "texto", body: "Bom dia! Pode conferir o pedido?" },
    t0,
  );
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "escrevente",
    { kind: "chamar" },
    new Date(t0.getTime() + 1000),
  );
  await assert.rejects(
    sendMessageWith(
      db,
      OFFICE,
      id,
      "escrevente",
      { kind: "chamar" },
      new Date(t0.getTime() + 5000),
    ),
    /Aguarde/,
  );
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "auxiliar",
    {
      kind: "arquivo",
      file: {
        path: "uploads/x.pdf",
        name: "certidao-ficticia.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      },
    },
    new Date(t0.getTime() + 20_000),
  );
  // Someone outside the conversation does not read it; the holder does.
  assert.equal(
    await listMessagesWith(db, OFFICE, id, { id: "titular", oversight: false }),
    undefined,
  );
  const all = await listMessagesWith(db, OFFICE, id, {
    id: "titular",
    oversight: true,
  });
  assert.deepEqual(
    all?.map((m) => m.kind),
    ["texto", "chamar", "arquivo"],
  );
  assert.equal(all?.[0].senderName, "João Fictício de Souza");
  // Unread: the escrevente has the file to read; the auxiliar read by answering.
  const contacts = await listContactsWith(db, OFFICE, "escrevente", t0);
  assert.equal(contacts.find((c) => c.userId === "auxiliar")?.unread, 1);
  assert.ok(!contacts.some((c) => c.userId === "de-fora"));
  const inbox = await inboxWith(db, "auxiliar", new Date(t0.getTime() - 1));
  assert.deepEqual(
    inbox.incoming.map((i) => i.kind),
    ["texto", "chamar"],
  );
  assert.equal(inbox.incoming[1].preview, "chamou a sua atenção!");
  // Files: members and the holder, nobody else.
  const fileId = all?.[2].id ?? "";
  assert.ok(
    await findMessageFileWith(db, OFFICE, fileId, {
      id: "escrevente",
      oversight: false,
    }),
  );
  assert.ok(
    await findMessageFileWith(db, OFFICE, fileId, {
      id: "titular",
      oversight: true,
    }),
  );
  assert.equal(
    await findMessageFileWith(db, OFFICE, fileId, {
      id: "titular",
      oversight: false,
    }),
    undefined,
  );
  // The holder's list of every conversation.
  const oversight = await listAllConversationsWith(db, OFFICE);
  assert.deepEqual(oversight[0].members, [
    "Ana Modelo Pereira",
    "João Fictício de Souza",
  ]);
  assert.equal(oversight[0].messages, 3);
  // Only members send.
  await assert.rejects(
    sendMessageWith(db, OFFICE, id, "titular", { kind: "texto", body: "Oi" }),
    MessageError,
  );
});

test("perfil e presença: status escolhido enquanto online, offline depois", async () => {
  const now = new Date("2026-11-11T15:00:00Z");
  await updateProfileWith(
    db,
    OFFICE,
    "auxiliar",
    {
      status: "ocupado",
      personalMessage: "Em atendimento no balcão",
      color: "azul",
    },
    now,
  );
  await touchPresenceWith(db, OFFICE, "auxiliar", now);
  const seen = await listContactsWith(
    db,
    OFFICE,
    "escrevente",
    new Date(now.getTime() + 30_000),
  );
  const ana = seen.find((c) => c.userId === "auxiliar");
  assert.equal(ana?.presence, "ocupado");
  assert.equal(ana?.personalMessage, "Em atendimento no balcão");
  const later = await listContactsWith(
    db,
    OFFICE,
    "escrevente",
    new Date(now.getTime() + 10 * 60_000),
  );
  assert.equal(later.find((c) => c.userId === "auxiliar")?.presence, "offline");
});
