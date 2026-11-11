import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { DEFAULT_LEGAL_BASIS } from "@/core/audit/labels.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import { auditLog } from "@/db/schema.ts";
import { createTestDb } from "@/db/test-db.ts";
import {
  addAuditNoteWith,
  answerNotificationWith,
  closeNotificationWith,
  createNotificationWith,
  findNotificationWith,
  listAuditWith,
  listNotificationsWith,
  NotificationError,
  openNotificationCountWith,
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
