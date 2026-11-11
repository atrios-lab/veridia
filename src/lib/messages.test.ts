import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  clearConversationWith,
  decideLunchWith,
  deleteMessageWith,
  editMessageWith,
  findMessageFileWith,
  getProfileWith,
  inboxWith,
  lingeringStatusesWith,
  listAllConversationsWith,
  listContactsWith,
  listMessagesWith,
  listTeamWith,
  MessageError,
  onlineNowWith,
  openDirectWith,
  requestLunchWith,
  returnFromLunchWith,
  sendMessageWith,
  setChatDisabledWith,
  setStatusByHolderWith,
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

test("almoço: pedido espera o titular, não muda de novo até a decisão, e chat desligado não recebe", async () => {
  await assert.rejects(
    requestLunchWith(db, OFFICE, "escrevente", "12:00", 90),
    /1 hora/,
  );
  await requestLunchWith(db, OFFICE, "escrevente", "12:00", 60);
  await assert.rejects(
    requestLunchWith(db, OFFICE, "escrevente", "13:00", 30),
    /esperando/,
  );
  let team = await listTeamWith(db, OFFICE);
  assert.deepEqual(team.find((m) => m.userId === "escrevente")?.lunchPending, {
    start: "12:00",
    minutes: 60,
  });
  assert.equal(
    await decideLunchWith(db, OFFICE, "escrevente", true, "titular"),
    true,
  );
  team = await listTeamWith(db, OFFICE);
  const joao = team.find((m) => m.userId === "escrevente");
  assert.deepEqual(joao?.lunch, { start: "12:00", minutes: 60 });
  assert.equal(joao?.lunchPending, null);
  // 12:30 in Brasília (15:30 UTC): shows lunch while online; after, available.
  await touchPresenceWith(
    db,
    OFFICE,
    "escrevente",
    new Date("2026-11-11T15:30:00Z"),
  );
  const atLunch = await listContactsWith(
    db,
    OFFICE,
    "auxiliar",
    new Date("2026-11-11T15:30:30Z"),
  );
  assert.equal(
    atLunch.find((c) => c.userId === "escrevente")?.presence,
    "almoco",
  );
  await touchPresenceWith(
    db,
    OFFICE,
    "escrevente",
    new Date("2026-11-11T16:05:00Z"),
  );
  const after = await listContactsWith(
    db,
    OFFICE,
    "auxiliar",
    new Date("2026-11-11T16:05:30Z"),
  );
  assert.notEqual(
    after.find((c) => c.userId === "escrevente")?.presence,
    "almoco",
  );

  await setChatDisabledWith(db, OFFICE, "auxiliar", true, "titular");
  await assert.rejects(
    openDirectWith(db, OFFICE, "titular", "auxiliar"),
    /desativado/,
  );
  await setChatDisabledWith(db, OFFICE, "auxiliar", false, "titular");
  assert.ok(await openDirectWith(db, OFFICE, "titular", "auxiliar"));
});

test("editar, apagar e limpar: nada sai do banco, o titular vê tudo", async () => {
  const id = await openDirectWith(db, OFFICE, "titular", "auxiliar");
  const t0 = new Date("2026-11-11T15:00:00Z");
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "auxiliar",
    { kind: "texto", body: "Protocolo fictício 123 conferido." },
    t0,
  );
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "auxiliar",
    {
      kind: "arquivo",
      file: {
        path: "uploads/y.pdf",
        name: "rascunho-ficticio.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    },
    at(1),
  );
  const auxiliar = { id: "auxiliar", oversight: false };
  const titular = { id: "titular", oversight: true };
  const [text, file] = (await listMessagesWith(db, OFFICE, id, auxiliar)) ?? [];
  assert.ok(text && file);

  // Only the author edits, only text, and the first version stays.
  await assert.rejects(
    editMessageWith(db, OFFICE, text.id, "titular", "Outro texto", at(2)),
    MessageError,
  );
  await assert.rejects(
    editMessageWith(db, OFFICE, file.id, "auxiliar", "Texto", at(2)),
    MessageError,
  );
  await editMessageWith(
    db,
    OFFICE,
    text.id,
    "auxiliar",
    "Protocolo fictício 124 conferido.",
    at(2),
  );
  await editMessageWith(
    db,
    OFFICE,
    text.id,
    "auxiliar",
    "Protocolo fictício 125 conferido.",
    at(3),
  );

  // Only the author deletes; the member sees no content, the holder does.
  await assert.rejects(
    deleteMessageWith(db, OFFICE, file.id, "titular", at(4)),
    MessageError,
  );
  await deleteMessageWith(db, OFFICE, file.id, "auxiliar", at(4));
  await assert.rejects(
    deleteMessageWith(db, OFFICE, file.id, "auxiliar", at(5)),
    MessageError,
  );

  // An open screen gets the changes since its last look.
  const changes =
    (await listMessagesWith(db, OFFICE, id, auxiliar, {
      after: at(1.5),
    })) ?? [];
  assert.deepEqual(
    changes.map((m) => m.id),
    [text.id, file.id],
  );
  const [edited, gone] = changes;
  assert.equal(edited?.body, "Protocolo fictício 125 conferido.");
  assert.ok(edited?.editedAt);
  assert.equal(edited?.originalBody, null);
  assert.equal(gone?.deleted, true);
  assert.equal(gone?.fileName, null);
  assert.equal(
    await findMessageFileWith(db, OFFICE, file.id, auxiliar),
    undefined,
  );
  assert.ok(await findMessageFileWith(db, OFFICE, file.id, titular));

  const full =
    (await listMessagesWith(db, OFFICE, id, titular, {
      full: true,
    })) ?? [];
  assert.equal(full[0]?.originalBody, "Protocolo fictício 123 conferido.");
  assert.equal(full[1]?.fileName, "rascunho-ficticio.pdf");
  assert.equal(full[1]?.deleted, true);

  // "Limpar conversa" clears it for both members; the holder's oversight
  // still reads it all.
  await assert.rejects(
    clearConversationWith(db, OFFICE, id, "escrevente", at(6)),
    MessageError,
  );
  await clearConversationWith(db, OFFICE, id, "auxiliar", at(6));
  assert.deepEqual(await listMessagesWith(db, OFFICE, id, auxiliar), []);
  assert.deepEqual(
    await listMessagesWith(db, OFFICE, id, { id: "titular", oversight: false }),
    [],
  );
  assert.equal(
    (await listMessagesWith(db, OFFICE, id, titular, { full: true }))?.length,
    2,
  );
  await sendMessageWith(
    db,
    OFFICE,
    id,
    "titular",
    { kind: "texto", body: "Obrigada!" },
    at(7),
  );
  assert.deepEqual(
    (await listMessagesWith(db, OFFICE, id, auxiliar))?.map((m) => m.body),
    ["Obrigada!"],
  );
});

test("status longe avisa o titular aos 40 min e volta a disponível aos 60; almoço com 'voltei'", async () => {
  // The next day: the earlier tests used 11/11.
  const t0 = new Date("2026-11-12T09:00:00-03:00");
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
  await updateProfileWith(db, OFFICE, "auxiliar", { status: "ocupado" }, t0);
  // Saving the personal message again does not restart the clock.
  await updateProfileWith(
    db,
    OFFICE,
    "auxiliar",
    { status: "ocupado", personalMessage: "Conferindo escrituras" },
    at(20),
  );
  await touchPresenceWith(db, OFFICE, "auxiliar", at(41));
  const late = await lingeringStatusesWith(db, OFFICE, at(41));
  assert.deepEqual(
    late.map((p) => [p.userId, p.status]),
    [["auxiliar", "ocupado"]],
  );
  // The holder changes it; the clock restarts and the alert goes.
  await setStatusByHolderWith(
    db,
    OFFICE,
    "auxiliar",
    "disponivel",
    "titular",
    at(42),
  );
  assert.deepEqual(await lingeringStatusesWith(db, OFFICE, at(43)), []);
  await assert.rejects(
    setStatusByHolderWith(db, OFFICE, "de-fora", "ocupado", "titular", at(43)),
    MessageError,
  );

  // Away again, then 60 minutes: available again on the next poll.
  await updateProfileWith(
    db,
    OFFICE,
    "auxiliar",
    { status: "ausente" },
    at(50),
  );
  await touchPresenceWith(db, OFFICE, "auxiliar", at(111));
  assert.equal(
    (await getProfileWith(db, OFFICE, "auxiliar"))?.status,
    "disponivel",
  );

  // Lunch: locked inside the window until "voltei do almoço".
  const noon = new Date("2026-11-12T12:10:00-03:00");
  await requestLunchWith(db, OFFICE, "auxiliar", "12:00", 60, noon);
  await decideLunchWith(db, OFFICE, "auxiliar", true, "titular");
  const { atLunch } = await import("@/core/messages/rules.ts");
  const lunch = (await getProfileWith(db, OFFICE, "auxiliar"))?.lunch;
  assert.equal(atLunch(lunch, null, noon), true);
  await returnFromLunchWith(db, OFFICE, "auxiliar", noon);
  const back = await getProfileWith(db, OFFICE, "auxiliar");
  assert.equal(back?.status, "disponivel");
});

test("quem está online agora: para o aviso 'acabou de entrar'", async () => {
  const now = new Date("2026-11-13T10:00:00-03:00");
  await touchPresenceWith(db, OFFICE, "escrevente", now);
  await touchPresenceWith(
    db,
    OFFICE,
    "auxiliar",
    new Date(now.getTime() - 5 * 60_000),
  );
  const online = await onlineNowWith(db, OFFICE, "titular", now);
  // Seen in the last 90 s only; never the viewer; never another office.
  assert.deepEqual(
    online.map((p) => p.userId),
    ["escrevente"],
  );
  assert.deepEqual(await onlineNowWith(db, OFFICE, "escrevente", now), []);
  await setChatDisabledWith(db, OFFICE, "escrevente", true, "titular");
  assert.deepEqual(await onlineNowWith(db, OFFICE, "titular", now), []);
  await setChatDisabledWith(db, OFFICE, "escrevente", false, "titular");
});
