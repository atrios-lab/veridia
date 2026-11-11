import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq } from "drizzle-orm";
import { DEFAULT_LEGAL_BASIS } from "@/core/audit/labels.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog, auditNotes } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import { recordAuditWith } from "./audit.ts";
import { justify } from "./audit-reason.ts";
import {
  addAuditNoteWith,
  answerNotificationWith,
  closeNotificationWith,
  createNotificationWith,
  editAuditNoteWith,
  findNotificationWith,
  listAuditWith,
  listNotificationsWith,
  markReviewedWith,
  NotificationError,
  openNotificationCountWith,
  pendingUrgentCountWith,
  peopleSummaryWith,
  removeAuditNoteWith,
  setArchivedWith,
} from "./audit-trail.ts";

let db: Database;
let close: () => Promise<void>;
// Fictitious people and offices only (LGPD).
const OFFICE = "cartorio-marinho";
const OTHER = "cartorio-exemplo";
let entryId = "";
let otherEntryId = "";

before(async () => {
  ({ db, close } = await createTestDb());
  await db.insert(user).values([
    {
      id: "titular",
      name: "Maria Exemplo da Silva",
      email: "maria.auditoria@exemplo.com",
      tenantSlug: OFFICE,
      role: "admin",
    },
    {
      id: "escrevente",
      name: "João Fictício de Souza",
      email: "joao.auditoria@exemplo.com",
      tenantSlug: OFFICE,
      role: "staff",
    },
    {
      id: "de-fora",
      name: "Ana Modelo Pereira",
      email: "ana.auditoria@exemplo.com",
      tenantSlug: OTHER,
      role: "staff",
    },
  ]);
  const rows = await db
    .insert(auditLog)
    .values([
      {
        tenantSlug: OFFICE,
        actorId: "escrevente",
        action: "request.status",
        targetType: "service-request",
        targetId: "2026-000123",
        createdAt: new Date("2026-11-10T13:00:00Z"),
      },
      {
        tenantSlug: OFFICE,
        actorId: "titular",
        action: "user.create",
        targetType: "user",
        targetId: "escrevente",
        createdAt: new Date("2026-11-09T13:00:00Z"),
      },
      {
        tenantSlug: OTHER,
        actorId: "de-fora",
        action: "request.status",
        targetType: "service-request",
        targetId: "2026-000999",
        createdAt: new Date("2026-11-10T14:00:00Z"),
      },
    ])
    .returning({ id: auditLog.id, tenantSlug: auditLog.tenantSlug });
  entryId = rows[0].id;
  otherEntryId = rows[2].id;
});
after(async () => {
  await close();
});

test("a trilha de uma serventia não mostra a de outra; a da Átrios mostra todas", async () => {
  const own = await listAuditWith(db, { tenantSlugs: [OFFICE] });
  assert.equal(own.length, 2);
  assert.ok(own.every((entry) => entry.tenantSlug === OFFICE));
  assert.equal(own[0].actorName, "João Fictício de Souza");
  const all = await listAuditWith(db, { tenantSlugs: "all" });
  assert.ok(all.some((entry) => entry.tenantSlug === OTHER));
  assert.deepEqual(await listAuditWith(db, { tenantSlugs: [] }), []);
});

test("filtra por pessoa, período e texto", async () => {
  const byPerson = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    actorId: "titular",
  });
  assert.deepEqual(
    byPerson.map((e) => e.action),
    ["user.create"],
  );
  const byDay = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    from: new Date("2026-11-10T00:00:00Z"),
  });
  assert.equal(byDay.length, 1);
  const byText = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    text: "000123",
  });
  assert.equal(byText.length, 1);
});

test("anotação fica no registro, que não muda; outra serventia não anota", async () => {
  assert.equal(
    await addAuditNoteWith(
      db,
      OFFICE,
      entryId,
      "Conferir com o livro.",
      "titular",
    ),
    true,
  );
  assert.equal(
    await addAuditNoteWith(db, OFFICE, entryId, "   ", "titular"),
    false,
  );
  assert.equal(
    await addAuditNoteWith(db, OFFICE, otherEntryId, "Não pode.", "titular"),
    false,
  );
  // The Átrios account notes on any office.
  assert.equal(
    await addAuditNoteWith(
      db,
      "*",
      otherEntryId,
      "Visto pela Átrios.",
      "mestre",
    ),
    true,
  );
  const [entry] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [entryId],
  });
  assert.equal(entry.notes.length, 1);
  assert.equal(entry.notes[0].body, "Conferir com o livro.");
  assert.equal(entry.targetId, "2026-000123");
});

test("notificação: número do ano, prazo de 24 horas, só a pessoa responde, uma vez", async () => {
  const now = new Date("2026-11-11T12:00:00Z");
  const created = await createNotificationWith(
    db,
    OFFICE,
    {
      targetUserId: "escrevente",
      subject: "Esclarecimentos sobre atos registrados no painel",
      facts: "Mudança de situação do pedido 2026-000123.",
      legalBasis: DEFAULT_LEGAL_BASIS,
      auditIds: [entryId],
    },
    "titular",
    now,
  );
  assert.equal(created.year, 2026);
  assert.equal(created.sequence, 1);
  const view = await findNotificationWith(db, OFFICE, created.id);
  assert.ok(view);
  assert.equal(view.deadlineAt.getTime() - now.getTime(), 24 * 60 * 60 * 1000);
  assert.equal(view.status, "aberta");
  assert.equal(view.targetName, "João Fictício de Souza");
  assert.equal(view.targetEmail, "joao.auditoria@exemplo.com");
  assert.equal(await openNotificationCountWith(db, OFFICE, "escrevente"), 1);
  assert.equal(
    (await listNotificationsWith(db, OFFICE, "escrevente")).length,
    1,
  );
  assert.equal((await listNotificationsWith(db, OFFICE, "titular")).length, 0);
  // Another office never sees it.
  assert.equal(await findNotificationWith(db, OTHER, created.id), undefined);

  await assert.rejects(
    answerNotificationWith(
      db,
      OFFICE,
      created.id,
      "titular",
      "Eu respondo.",
      [],
    ),
    NotificationError,
  );
  await answerNotificationWith(
    db,
    OFFICE,
    created.id,
    "escrevente",
    "A parte pediu a mudança no balcão.",
    [
      {
        storedName: "x.png",
        displayName: "Captura de tela.png",
        path: "uploads/x.png",
        mimeType: "image/png",
        sizeBytes: 2048,
      },
    ],
  );
  const answered = await findNotificationWith(db, OFFICE, created.id);
  assert.equal(answered?.status, "respondida");
  assert.equal(answered?.files[0]?.side, "notificado");
  assert.equal(await openNotificationCountWith(db, OFFICE, "escrevente"), 0);
  await assert.rejects(
    answerNotificationWith(
      db,
      OFFICE,
      created.id,
      "escrevente",
      "De novo.",
      [],
    ),
    NotificationError,
  );

  assert.equal(
    await closeNotificationWith(
      db,
      OFFICE,
      created.id,
      "Justificado.",
      "titular",
    ),
    true,
  );
  assert.equal(
    (await findNotificationWith(db, OFFICE, created.id))?.status,
    "encerrada",
  );
  // Everything is on the trail too.
  const trail = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    text: "audit.notification",
  });
  assert.equal(trail.length, 3);
});

test("não notifica pessoa de outra serventia nem sem assunto", async () => {
  await assert.rejects(
    createNotificationWith(
      db,
      OFFICE,
      {
        targetUserId: "de-fora",
        subject: "Assunto",
        facts: "Fatos.",
        legalBasis: "",
        auditIds: [],
      },
      "titular",
    ),
    NotificationError,
  );
  await assert.rejects(
    createNotificationWith(
      db,
      OFFICE,
      {
        targetUserId: "escrevente",
        subject: " ",
        facts: "Fatos.",
        legalBasis: "",
        auditIds: [],
      },
      "titular",
    ),
    NotificationError,
  );
});

test("o alvo com id de conta aparece com o nome da pessoa", async () => {
  const id = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
  await db.insert(user).values({
    id,
    name: "Pedro Teste Auxiliar",
    email: "pedro.auditoria@exemplo.com",
    tenantSlug: OFFICE,
    role: "auxiliar",
  });
  const [row] = await db
    .insert(auditLog)
    .values({
      tenantSlug: OFFICE,
      actorId: "titular",
      action: "user.update",
      targetType: "user",
      targetId: id,
    })
    .returning({ id: auditLog.id });
  const [entry] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [row.id],
  });
  assert.equal(entry.targetLabel, "Pedro Teste Auxiliar");
  assert.equal(entry.targetId, id);
});

test("texto com CRLF é guardado com quebras simples", async () => {
  const created = await createNotificationWith(
    db,
    OFFICE,
    {
      targetUserId: "escrevente",
      subject: "Assunto",
      facts: "Linha um.\r\nLinha dois.",
      legalBasis: "Base.\r\n\r\nOutra base.",
      auditIds: [],
    },
    "titular",
  );
  const view = await findNotificationWith(db, OFFICE, created.id);
  assert.equal(view?.facts, "Linha um.\nLinha dois.");
  assert.equal(view?.legalBasis.includes("\r"), false);
  assert.equal(created.sequence, 2);
});

test("faixas: exclusão é urgente, fica pendente até o titular verificar; resumo por pessoa", async () => {
  const now = new Date();
  const rows = await db
    .insert(auditLog)
    .values([
      {
        tenantSlug: OFFICE,
        actorId: "escrevente",
        action: "service-request.delete",
        targetType: "service-request",
        targetId: "2026-000777",
        reason: "Pedido duplicado por engano.",
        createdAt: now,
      },
      {
        tenantSlug: OFFICE,
        actorId: "escrevente",
        action: "service-request.amount",
        targetType: "service-request",
        targetId: "2026-000777",
        createdAt: now,
      },
      {
        tenantSlug: OFFICE,
        actorId: "titular",
        action: "publication.delete",
        targetType: "publication",
        targetId: "x",
        createdAt: now,
      },
    ])
    .returning({ id: auditLog.id });
  const urgent = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    levels: ["urgente"],
    ids: rows.map((r) => r.id),
  });
  assert.deepEqual(urgent.map((e) => e.action).sort(), [
    "publication.delete",
    "service-request.delete",
  ]);
  assert.equal(
    urgent.find((e) => e.action === "service-request.delete")?.reason,
    "Pedido duplicado por engano.",
  );
  // The holder's own act does not alert himself.
  assert.equal(await pendingUrgentCountWith(db, OFFICE, "titular", now), 1);
  const people = await peopleSummaryWith(
    db,
    [OFFICE],
    new Date(now.getTime() - 60_000),
  );
  const joao = people.find((p) => p.actorId === "escrevente");
  assert.equal(joao?.urgente, 1);
  assert.equal(joao?.pendentes, 1);
  // The answer to the earlier notification counts too (also "atenção").
  assert.ok((joao?.atencao ?? 0) >= 1);
  assert.ok(
    people.every((p, i) => i === 0 || people[i - 1].pendentes >= p.pendentes),
  );

  assert.equal(
    await markReviewedWith(db, [OFFICE], [rows[0].id], "titular", now),
    1,
  );
  // Twice is harmless; another office cannot mark it.
  assert.equal(
    await markReviewedWith(db, [OFFICE], [rows[0].id], "titular", now),
    0,
  );
  assert.equal(
    await markReviewedWith(db, [OTHER], [rows[2].id], "de-fora", now),
    0,
  );
  assert.equal(await pendingUrgentCountWith(db, OFFICE, "titular", now), 0);
  const [seen] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [rows[0].id],
  });
  assert.equal(seen.reviewerName, "Maria Exemplo da Silva");
  assert.ok(seen.reviewedAt);
  assert.equal(
    (
      await listAuditWith(db, {
        tenantSlugs: [OFFICE],
        pending: true,
        ids: rows.map((r) => r.id),
      })
    ).length,
    1,
  );
  // "Lido e ok" takes an act out of its band's waiting list and into
  // "Analisadas e concluídas", whatever its band.
  const waitingAttention = () =>
    listAuditWith(db, {
      tenantSlugs: [OFFICE],
      levels: ["atencao"],
      pending: true,
      ids: [rows[1].id],
    });
  assert.equal((await waitingAttention()).length, 1);
  const before = (
    await peopleSummaryWith(db, [OFFICE], new Date(now.getTime() - 60_000))
  ).find((p) => p.actorId === "escrevente");
  await markReviewedWith(db, [OFFICE], [rows[1].id], "titular", now);
  assert.equal((await waitingAttention()).length, 0);
  const reviewed = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    reviewed: true,
    ids: rows.map((r) => r.id),
  });
  assert.deepEqual(reviewed.map((e) => e.action).sort(), [
    "service-request.amount",
    "service-request.delete",
  ]);
  const after = (
    await peopleSummaryWith(db, [OFFICE], new Date(now.getTime() - 60_000))
  ).find((p) => p.actorId === "escrevente");
  assert.equal(after?.atencaoPendentes, (before?.atencaoPendentes ?? 0) - 1);
  assert.equal(after?.analisadas, (before?.analisadas ?? 0) + 1);
  assert.equal(after?.atencao, before?.atencao);
});

test("a justificativa digitada vai para o registro do ato", async () => {
  const form = new FormData();
  form.set("justificativa", "ok");
  assert.match(justify(form) ?? "", /justificativa/);
  form.set("justificativa", "Documento enviado ao cidadão errado.");
  assert.equal(justify(form), null);
  await recordAuditWith(db, {
    tenantSlug: OFFICE,
    actorId: "escrevente",
    action: "service-request.attachment.delete",
    targetType: "service-request",
    targetId: "2026-000888",
  });
  const [entry] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    text: "000888",
  });
  assert.equal(entry.reason, "Documento enviado ao cidadão errado.");
  assert.equal(entry.level, "urgente");
});

test("a conta da Átrios é invisível para a serventia: atos, anotações, resumo e alertas", async () => {
  await db.insert(user).values({
    id: "plataforma",
    name: "Átrios",
    email: "mestre.auditoria@exemplo.com",
    tenantSlug: "atrios",
    role: "superadmin",
  });
  const now = new Date();
  const [act] = await db
    .insert(auditLog)
    .values({
      tenantSlug: OFFICE,
      actorId: "plataforma",
      action: "publication.delete",
      targetType: "publication",
      targetId: "teste-da-atrios",
      createdAt: now,
    })
    .returning({ id: auditLog.id });
  // The Átrios account notes on an office entry: hidden from the office too.
  await addAuditNoteWith(
    db,
    "*",
    entryId,
    "Nota interna da Átrios.",
    "plataforma",
  );

  const office = await listAuditWith(db, { tenantSlugs: [OFFICE] });
  assert.ok(!office.some((e) => e.id === act.id));
  assert.ok(
    !office.some((e) => e.notes.some((n) => n.body.includes("Átrios"))),
  );
  const atrios = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    includePlatform: true,
  });
  assert.ok(atrios.some((e) => e.id === act.id));
  assert.ok(atrios.some((e) => e.notes.some((n) => n.body.includes("Átrios"))));

  const since = new Date(now.getTime() - 60_000);
  assert.ok(
    !(await peopleSummaryWith(db, [OFFICE], since)).some(
      (p) => p.actorId === "plataforma",
    ),
  );
  assert.ok(
    (await peopleSummaryWith(db, [OFFICE], since, true)).some(
      (p) => p.actorId === "plataforma",
    ),
  );
  // Its urgent act never alerts the holder.
  const before = await pendingUrgentCountWith(db, OFFICE, "titular", now);
  await db.insert(auditLog).values({
    tenantSlug: OFFICE,
    actorId: "plataforma",
    action: "service-request.delete",
    targetType: "service-request",
    targetId: "teste-2",
    createdAt: now,
  });
  assert.equal(
    await pendingUrgentCountWith(db, OFFICE, "titular", now),
    before,
  );
});

test("arquivar tira da lista sem apagar, e anotação editada ou excluída fica guardada", async () => {
  const now = new Date();
  const [row] = await db
    .insert(auditLog)
    .values({
      tenantSlug: OFFICE,
      actorId: "escrevente",
      action: "service-request.status",
      targetType: "service-request",
      targetId: "REQ-2026-000555",
      createdAt: now,
    })
    .returning({ id: auditLog.id });
  assert.equal(
    await setArchivedWith(db, [OFFICE], [row.id], "titular", true, now),
    1,
  );
  const listed = await listAuditWith(db, { tenantSlugs: [OFFICE] });
  assert.ok(!listed.some((e) => e.id === row.id));
  const archived = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    archived: true,
  });
  assert.ok(archived.some((e) => e.id === row.id && e.reviewedAt));
  // Another office cannot archive it back.
  assert.equal(
    await setArchivedWith(db, [OTHER], [row.id], "de-fora", false, now),
    0,
  );
  await setArchivedWith(db, [OFFICE], [row.id], "titular", false, now);
  assert.ok(
    (await listAuditWith(db, { tenantSlugs: [OFFICE] })).some(
      (e) => e.id === row.id,
    ),
  );

  await addAuditNoteWith(db, OFFICE, row.id, "Primeira versão.", "titular");
  const [withNote] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [row.id],
  });
  const noteId = withNote.notes[0].id;
  assert.equal(
    await editAuditNoteWith(db, OFFICE, noteId, "Versão corrigida."),
    true,
  );
  assert.equal(await editAuditNoteWith(db, OTHER, noteId, "Não pode."), false);
  const [edited] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [row.id],
  });
  assert.equal(edited.notes[0].body, "Versão corrigida.");
  assert.ok(edited.notes[0].editedAt);
  assert.equal(await removeAuditNoteWith(db, OFFICE, noteId, "titular"), true);
  const [gone] = await listAuditWith(db, {
    tenantSlugs: [OFFICE],
    ids: [row.id],
  });
  assert.equal(gone.notes.length, 0);
  // Excluded from the screen, still in the database.
  const kept = await db
    .select()
    .from(auditNotes)
    .where(eq(auditNotes.id, noteId));
  assert.equal(kept.length, 1);
  assert.ok(kept[0].removedAt);
});
