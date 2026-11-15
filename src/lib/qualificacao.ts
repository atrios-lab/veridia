import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { LIBRARY_SEEDS, servesAct } from "@/core/qualificacao/biblioteca.ts";
import {
  type DeadlineSettings,
  parseDeadlineSettings,
} from "@/core/qualificacao/prazos.ts";
import {
  type Attribution,
  currentRound,
  isAttribution,
  noteProblems,
  openReexam,
  positiveProblems,
  type QualificationData,
  type QualificationStatus,
  qualificationFrom,
  qualificationProblems,
  type RequirementStatus,
  requirementProblems,
  statusOf,
} from "@/core/qualificacao/qualificacao.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import type { Database } from "@/db/index.ts";
import {
  qualificationLibrary,
  qualificationNotes,
  qualifications,
  serviceRequestAttachments,
  serviceRequests,
  tenantContent,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { nextNumberWith } from "./document-numbering.ts";
import { OFFICE_QUALIFICATION_KEY } from "./office-config.ts";

/**
 * The qualificação de títulos (change qualificacao-de-titulos, decision of
 * 15/11/2026): the títulos under exam, the library of exigências and the
 * notes issued. Nothing is deleted: excluded by a mark, with a
 * justification; an issued number is never reused.
 */

export class QualificationError extends Error {}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const ATTEMPTS = 5;

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3) {
    throw new QualificationError(
      "Escreva a justificativa (pelo menos 3 letras).",
    );
  }
  return clean.slice(0, 5000);
}

// ---------------------------------------------------------------- library

export interface LibraryItem {
  id: string;
  attribution: Attribution;
  acts: string[];
  title: string;
  description: string;
  howToComply: string;
  basis: string;
  seedKey: string | null;
  uses: number;
  removedAt: Date | null;
  removedReason: string | null;
}

export interface LibraryInput {
  attribution: Attribution;
  acts: string[];
  title: string;
  description: string;
  howToComply: string;
  basis: string;
}

const toItem = (
  row: typeof qualificationLibrary.$inferSelect,
): LibraryItem => ({
  id: row.id,
  attribution: isAttribution(row.attribution) ? row.attribution : "rcpn",
  acts: Array.isArray(row.acts)
    ? (row.acts as unknown[]).filter((a): a is string => typeof a === "string")
    : [],
  title: row.title,
  description: row.description,
  howToComply: row.howToComply,
  basis: row.basis,
  seedKey: row.seedKey,
  uses: row.uses,
  removedAt: row.removedAt,
  removedReason: row.removedReason,
});

function mustItem(input: LibraryInput): LibraryInput {
  const clean = {
    attribution: input.attribution,
    acts: [...new Set(input.acts.map((a) => a.trim()).filter(Boolean))].slice(
      0,
      30,
    ),
    title: input.title.trim().slice(0, 300),
    description: input.description.trim().slice(0, 5000),
    howToComply: input.howToComply.trim().slice(0, 5000),
    basis: input.basis.trim().slice(0, 1000),
  };
  if (!isAttribution(clean.attribution)) {
    throw new QualificationError("Escolha a atribuição.");
  }
  const problems = requirementProblems({
    id: "x",
    ...clean,
    reference: "",
    status: "pendente",
    note: "",
    round: 1,
    fromNewDocument: false,
    fromAi: false,
    reviewed: false,
    excerpt: "",
  });
  if (problems.length) throw new QualificationError(problems.join(" "));
  return clean;
}

/**
 * The first exigências of the attribution, once per office: a seed the
 * office already has (edited or excluded) is never inserted again.
 */
export async function seedLibraryWith(
  database: Database,
  tenantSlug: string,
  attribution: Attribution,
): Promise<void> {
  const seeds = LIBRARY_SEEDS.filter((s) => s.attribution === attribution);
  if (seeds.length === 0) return;
  await database
    .insert(qualificationLibrary)
    .values(
      seeds.map((s) => ({
        tenantSlug,
        attribution: s.attribution,
        acts: s.acts,
        title: s.title,
        description: s.description,
        howToComply: s.howToComply,
        basis: s.basis,
        seedKey: s.key,
        createdBy: "sistema",
      })),
    )
    .onConflictDoNothing({
      target: [qualificationLibrary.tenantSlug, qualificationLibrary.seedKey],
    });
}

/** The library of the attribution, the most used first; by act when given. */
export async function listLibraryWith(
  database: Database,
  tenantSlug: string,
  attribution: Attribution,
  options: { act?: string; removed?: boolean } = {},
): Promise<LibraryItem[]> {
  await seedLibraryWith(database, tenantSlug, attribution);
  const rows = await database
    .select()
    .from(qualificationLibrary)
    .where(
      and(
        eq(qualificationLibrary.tenantSlug, tenantSlug),
        eq(qualificationLibrary.attribution, attribution),
        options.removed
          ? sql`${qualificationLibrary.removedAt} is not null`
          : isNull(qualificationLibrary.removedAt),
      ),
    )
    .orderBy(desc(qualificationLibrary.uses), asc(qualificationLibrary.title));
  const items = rows.map(toItem);
  const act = options.act;
  return act ? items.filter((i) => servesAct(i, act)) : items;
}

export async function getLibraryItemWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<LibraryItem | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(qualificationLibrary)
    .where(
      and(
        eq(qualificationLibrary.tenantSlug, tenantSlug),
        eq(qualificationLibrary.id, id),
      ),
    );
  return row ? toItem(row) : null;
}

export async function createLibraryItemWith(
  database: Database,
  tenantSlug: string,
  input: LibraryInput,
  actorId: string,
): Promise<string> {
  const clean = mustItem(input);
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(qualificationLibrary)
      .values({ tenantSlug, ...clean, createdBy: actorId })
      .returning({ id: qualificationLibrary.id });
    if (!row) throw new QualificationError("Não foi possível salvar agora.");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.library-create",
      targetType: "qualification-library",
      targetId: clean.title,
    });
    return row.id;
  });
}

export async function updateLibraryItemWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: LibraryInput,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  const clean = mustItem(input);
  const found = await getLibraryItemWith(database, tenantSlug, id);
  if (!found || found.removedAt) {
    throw new QualificationError("Exigência não encontrada.");
  }
  await database.transaction(async (tx) => {
    await tx
      .update(qualificationLibrary)
      .set({ ...clean, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(qualificationLibrary.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.library-edit",
      targetType: "qualification-library",
      targetId: clean.title,
      reason: why,
    });
  });
}

/** Excluded (or back, with `restore`) by a mark, with a justification. */
export async function markLibraryItemWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
  restore = false,
): Promise<void> {
  const why = mustReason(reason);
  const found = await getLibraryItemWith(database, tenantSlug, id);
  if (!found || Boolean(found.removedAt) === !restore) {
    throw new QualificationError("Exigência não encontrada.");
  }
  await database.transaction(async (tx) => {
    await tx
      .update(qualificationLibrary)
      .set(
        restore
          ? {
              removedAt: null,
              removedBy: null,
              removedReason: null,
              updatedAt: new Date(),
              updatedBy: actorId,
            }
          : { removedAt: new Date(), removedBy: actorId, removedReason: why },
      )
      .where(eq(qualificationLibrary.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: restore
        ? "qualificacao.library-restore"
        : "qualificacao.library-remove",
      targetType: "qualification-library",
      targetId: found.title,
      reason: why,
    });
  });
}

// ---------------------------------------------------------- qualificações

export interface StoredQualification {
  id: string;
  data: QualificationData;
  status: QualificationStatus;
  createdAt: Date;
  updatedAt: Date | null;
  removedAt: Date | null;
  removedReason: string | null;
}

export interface StoredNote {
  id: string;
  qualificationId: string;
  kind: "devolutiva" | "positiva";
  number: string;
  year: number;
  sequence: number;
  roundIndex: number;
  snapshot: QualificationData;
  issuedOn: string;
  signer: { name: string; role: string };
  createdAt: Date;
  removedAt: Date | null;
  removedReason: string | null;
}

const toQualification = (
  row: typeof qualifications.$inferSelect,
): StoredQualification => {
  const data = qualificationFrom(row.data);
  return {
    id: row.id,
    data,
    status: statusOf(data),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    removedAt: row.removedAt,
    removedReason: row.removedReason,
  };
};

const toNote = (row: typeof qualificationNotes.$inferSelect): StoredNote => ({
  id: row.id,
  qualificationId: row.qualificationId,
  kind: row.kind === "positiva" ? "positiva" : "devolutiva",
  number: `${row.sequence}/${row.year}`,
  year: row.year,
  sequence: row.sequence,
  roundIndex: row.roundIndex,
  snapshot: qualificationFrom(row.snapshot),
  issuedOn: row.issuedOn,
  signer: { name: row.signerName, role: row.signerRole },
  createdAt: row.createdAt,
  removedAt: row.removedAt,
  removedReason: row.removedReason,
});

function mustData(data: QualificationData): QualificationData {
  const clean = qualificationFrom(data);
  const problems = qualificationProblems(clean);
  if (problems.length) throw new QualificationError(problems.join(" "));
  return clean;
}

export async function createQualificationWith(
  database: Database,
  tenantSlug: string,
  data: QualificationData,
  actorId: string,
): Promise<string> {
  const clean = mustData(data);
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(qualifications)
      .values({
        tenantSlug,
        attribution: clean.attribution,
        status: statusOf(clean),
        data: clean,
        createdBy: actorId,
      })
      .returning({ id: qualifications.id });
    if (!row) throw new QualificationError("Não foi possível salvar agora.");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.create",
      targetType: "qualification",
      targetId: clean.protocol || clean.document.slice(0, 80),
    });
    return row.id;
  });
}

export async function getQualificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredQualification | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(qualifications)
    .where(
      and(eq(qualifications.tenantSlug, tenantSlug), eq(qualifications.id, id)),
    );
  return row ? toQualification(row) : null;
}

export async function listQualificationsWith(
  database: Database,
  tenantSlug: string,
  options: { attribution?: Attribution; removed?: boolean } = {},
): Promise<StoredQualification[]> {
  const rows = await database
    .select()
    .from(qualifications)
    .where(
      and(
        eq(qualifications.tenantSlug, tenantSlug),
        options.attribution
          ? eq(qualifications.attribution, options.attribution)
          : undefined,
        options.removed
          ? sql`${qualifications.removedAt} is not null`
          : isNull(qualifications.removedAt),
      ),
    )
    .orderBy(desc(qualifications.createdAt))
    .limit(500);
  return rows.map(toQualification);
}

/** The qualificações opened for a pedido of the online counter. */
export async function qualificationsOfProtocolWith(
  database: Database,
  tenantSlug: string,
  protocol: string,
): Promise<(StoredQualification & { notes: StoredNote[] })[]> {
  if (!protocol.trim()) return [];
  const rows = await database
    .select()
    .from(qualifications)
    .where(
      and(
        eq(qualifications.tenantSlug, tenantSlug),
        isNull(qualifications.removedAt),
        sql`${qualifications.data}->>'protocol' = ${protocol.trim()}`,
      ),
    )
    .orderBy(desc(qualifications.createdAt));
  return Promise.all(
    rows.map(async (row) => ({
      ...toQualification(row),
      notes: (await listNotesWith(database, tenantSlug, row.id)).filter(
        (n) => !n.removedAt,
      ),
    })),
  );
}

/**
 * The qualificação saved as edited. Only the open round's exigências may
 * change; a round already answered by a note stays as issued (exclude the
 * note to correct it). With a note issued, the change needs a reason.
 */
export async function saveQualificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  data: QualificationData,
  actorId: string,
  reason = "",
): Promise<void> {
  const found = await getQualificationWith(database, tenantSlug, id);
  if (!found || found.removedAt) {
    throw new QualificationError("Qualificação não encontrada.");
  }
  const clean = mustData(data);
  const before = found.data.rounds;
  if (clean.rounds.length !== before.length) {
    throw new QualificationError("As rodadas não podem ser trocadas por aqui.");
  }
  for (let i = 0; i < before.length - 1; i++) {
    if (JSON.stringify(clean.rounds[i]) !== JSON.stringify(before[i])) {
      throw new QualificationError(
        "Uma rodada já respondida por nota não muda. Para corrigir, exclua a nota emitida.",
      );
    }
  }
  const last = before[before.length - 1];
  if (last && last.result !== "aberta") {
    const kept = JSON.stringify(last);
    if (JSON.stringify(clean.rounds[before.length - 1]) !== kept) {
      throw new QualificationError(
        "Esta rodada já tem nota emitida. Para corrigir, exclua a nota; para seguir, registre a reapresentação.",
      );
    }
  }
  // After a note, changing what it printed (the presentation, the
  // fundamentos, the observações) needs a reason; working the open
  // round of a reexame does not.
  const issued = before.some((r) => r.result !== "aberta");
  const { rounds: _a, ...head } = clean;
  const { rounds: _b, ...headBefore } = found.data;
  const why =
    issued && JSON.stringify(head) !== JSON.stringify(headBefore)
      ? mustReason(reason)
      : reason.trim()
        ? reason.trim().slice(0, 5000)
        : undefined;
  await database.transaction(async (tx) => {
    await tx
      .update(qualifications)
      .set({
        data: clean,
        status: statusOf(clean),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(qualifications.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.edit",
      targetType: "qualification",
      targetId: clean.protocol || clean.document.slice(0, 80),
      ...(why ? { reason: why } : {}),
    });
  });
}

/** What the AI proposed, as it is written into the open round. */
export interface AiProposalInput {
  summary: string;
  /** In a reexame: the situation the AI sees for each earlier exigência. */
  previous?: { id: string; status: RequirementStatus; reason: string }[];
  requirements: {
    libraryId: string;
    title: string;
    description: string;
    howToComply: string;
    basis: string;
    reference: string;
    excerpt: string;
  }[];
}

/**
 * The AI's proposal written into the open round as drafts (decision of
 * 15/11/2026: nothing goes out without a person): each exigência marked
 * as the AI's and not checked; the note is blocked until a person checks
 * or removes each one. A library id the office does not have is dropped.
 */
export async function applyAiProposalWith(
  database: Database,
  tenantSlug: string,
  id: string,
  proposal: AiProposalInput,
  actorId: string,
  newId: () => string = () => crypto.randomUUID(),
): Promise<number> {
  const found = await getQualificationWith(database, tenantSlug, id);
  if (!found || found.removedAt) {
    throw new QualificationError("Qualificação não encontrada.");
  }
  const index = found.data.rounds.length - 1;
  const round = found.data.rounds[index];
  if (!round || round.result !== "aberta") {
    throw new QualificationError(
      "O Assistente Virtual propõe só na rodada aberta: registre a reapresentação primeiro.",
    );
  }
  const library = new Set(
    (await listLibraryWith(database, tenantSlug, found.data.attribution)).map(
      (l) => l.id,
    ),
  );
  const drafts = proposal.requirements
    .filter((r) => r.title.trim())
    .slice(0, 40)
    .map((r) => ({
      id: newId(),
      ...(library.has(r.libraryId) ? { libraryId: r.libraryId } : {}),
      title: r.title.trim().slice(0, 300),
      description: r.description.trim().slice(0, 5000),
      howToComply: r.howToComply.trim().slice(0, 5000),
      basis: r.basis.trim().slice(0, 1000),
      reference: r.reference.trim().slice(0, 200),
      status: "pendente" as const,
      note: "",
      round: round.n,
      fromNewDocument: round.n > 1,
      fromAi: true,
      reviewed: false,
      excerpt: r.excerpt.trim().slice(0, 2000),
    }));
  const next: QualificationData = {
    ...found.data,
    rounds: found.data.rounds.map((r, i) =>
      i === index
        ? {
            ...r,
            aiNote: proposal.summary.trim().slice(0, 3000),
            requirements: [
              ...r.requirements.map((existing) => {
                const seen = proposal.previous?.find(
                  (p) => p.id === existing.id,
                );
                // A suggestion only on what came from an earlier note; it
                // waits for a person like any other proposal.
                return seen && existing.round < r.n
                  ? {
                      ...existing,
                      status: seen.status,
                      note: `Sugestão do Assistente Virtual: ${seen.reason.trim().slice(0, 1000)}`,
                      fromAi: true,
                      reviewed: false,
                    }
                  : existing;
              }),
              ...drafts,
            ],
          }
        : r,
    ),
  };
  await database.transaction(async (tx) => {
    await tx
      .update(qualifications)
      .set({
        data: next,
        status: statusOf(next),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(qualifications.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "ai.qualify",
      targetType: "qualification",
      targetId: next.protocol || next.document.slice(0, 80),
    });
  });
  return drafts.length;
}

/** The título came back: a new round with what is still pending. */
export async function reexamWith(
  database: Database,
  tenantSlug: string,
  id: string,
  newDocuments: string,
  today: string,
  actorId: string,
): Promise<void> {
  const found = await getQualificationWith(database, tenantSlug, id);
  if (!found || found.removedAt) {
    throw new QualificationError("Qualificação não encontrada.");
  }
  if (currentRound(found.data).result !== "exigencia") {
    throw new QualificationError(
      "A reapresentação é registrada depois de emitida a nota devolutiva.",
    );
  }
  const next = openReexam(found.data, today, newDocuments);
  await database.transaction(async (tx) => {
    await tx
      .update(qualifications)
      .set({
        data: next,
        status: statusOf(next),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(qualifications.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.reexam",
      targetType: "qualification",
      targetId: next.protocol || next.document.slice(0, 80),
    });
  });
}

/** Excluded (or back, with `restore`) by a mark, with a justification. */
export async function markQualificationWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
  restore = false,
): Promise<void> {
  const why = mustReason(reason);
  const found = await getQualificationWith(database, tenantSlug, id);
  if (!found || Boolean(found.removedAt) === !restore) {
    throw new QualificationError("Qualificação não encontrada.");
  }
  await database.transaction(async (tx) => {
    await tx
      .update(qualifications)
      .set(
        restore
          ? {
              removedAt: null,
              removedBy: null,
              removedReason: null,
              updatedAt: new Date(),
              updatedBy: actorId,
            }
          : { removedAt: new Date(), removedBy: actorId, removedReason: why },
      )
      .where(eq(qualifications.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: restore ? "qualificacao.restore" : "qualificacao.remove",
      targetType: "qualification",
      targetId: found.data.protocol || found.data.document.slice(0, 80),
      reason: why,
    });
  });
}

// ------------------------------------------------------------------ notes

/**
 * Issues the nota devolutiva or the qualificação positiva of the open
 * round, with the year's next number; the round is closed with it and the
 * library items used count once more.
 */
export async function issueNoteWith(
  database: Database,
  tenantSlug: string,
  id: string,
  kind: "devolutiva" | "positiva",
  input: { issuedOn: string; signer: { name: string; role: string } },
  actorId: string,
  now = new Date(),
): Promise<string> {
  const found = await getQualificationWith(database, tenantSlug, id);
  if (!found || found.removedAt) {
    throw new QualificationError("Qualificação não encontrada.");
  }
  const round = currentRound(found.data);
  if (round.result !== "aberta") {
    throw new QualificationError(
      "Esta rodada já tem nota emitida. Registre a reapresentação para reexaminar.",
    );
  }
  const problems =
    kind === "devolutiva" ? noteProblems(round) : positiveProblems(round);
  if (problems.length) throw new QualificationError(problems.join(" "));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issuedOn)) {
    throw new QualificationError("Informe a data da nota.");
  }
  const roundIndex = found.data.rounds.length - 1;
  const closed: QualificationData = {
    ...found.data,
    rounds: found.data.rounds.map((r, i) =>
      i === roundIndex
        ? { ...r, result: kind === "devolutiva" ? "exigencia" : "positiva" }
        : r,
    ),
  };
  const series =
    kind === "devolutiva" ? "nota-devolutiva" : "qualificacao-positiva";
  const year = officeYear(now);
  const usedLibrary = [
    ...new Set(
      round.requirements
        .map((r) => r.libraryId)
        .filter((l): l is string => Boolean(l && isUuid(l))),
    ),
  ];
  for (let attempt = 1; ; attempt++) {
    const sequence = await nextNumberWith(database, tenantSlug, series, year);
    try {
      return await database.transaction(async (tx) => {
        const [row] = await tx
          .insert(qualificationNotes)
          .values({
            tenantSlug,
            qualificationId: found.id,
            kind,
            year,
            sequence,
            roundIndex,
            snapshot: closed,
            issuedOn: input.issuedOn,
            signerName: input.signer.name.trim().slice(0, 200),
            signerRole: input.signer.role.trim().slice(0, 200),
            createdBy: actorId,
          })
          .returning({ id: qualificationNotes.id });
        if (!row)
          throw new QualificationError("Não foi possível emitir agora.");
        await tx
          .update(qualifications)
          .set({
            data: closed,
            status: statusOf(closed),
            updatedAt: now,
            updatedBy: actorId,
          })
          .where(eq(qualifications.id, found.id));
        if (usedLibrary.length) {
          await tx
            .update(qualificationLibrary)
            .set({ uses: sql`${qualificationLibrary.uses} + 1` })
            .where(
              and(
                eq(qualificationLibrary.tenantSlug, tenantSlug),
                inArray(qualificationLibrary.id, usedLibrary),
              ),
            );
        }
        await recordAuditWith(tx as unknown as Database, {
          tenantSlug,
          actorId,
          action:
            kind === "devolutiva"
              ? "qualificacao.note"
              : "qualificacao.positive",
          targetType: "qualification-note",
          targetId: `${sequence}/${year}`,
        });
        return row.id;
      });
    } catch (error) {
      if (isPostgresError(error, UNIQUE_VIOLATION) && attempt < ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
}

export async function listNotesWith(
  database: Database,
  tenantSlug: string,
  qualificationId: string,
): Promise<StoredNote[]> {
  if (!isUuid(qualificationId)) return [];
  const rows = await database
    .select()
    .from(qualificationNotes)
    .where(
      and(
        eq(qualificationNotes.tenantSlug, tenantSlug),
        eq(qualificationNotes.qualificationId, qualificationId),
      ),
    )
    .orderBy(asc(qualificationNotes.createdAt));
  return rows.map(toNote);
}

export async function getNoteWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredNote | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(qualificationNotes)
    .where(
      and(
        eq(qualificationNotes.tenantSlug, tenantSlug),
        eq(qualificationNotes.id, id),
      ),
    );
  return row ? toNote(row) : null;
}

/**
 * A note issued by mistake excluded, with a justification: it stays kept
 * with its number (never reused), and, when it answered the open round,
 * the round opens again to be corrected and issued anew.
 */
export async function removeNoteWith(
  database: Database,
  tenantSlug: string,
  noteId: string,
  reason: string,
  actorId: string,
): Promise<string> {
  const why = mustReason(reason);
  const note = await getNoteWith(database, tenantSlug, noteId);
  if (!note || note.removedAt)
    throw new QualificationError("Nota não encontrada.");
  const found = await getQualificationWith(
    database,
    tenantSlug,
    note.qualificationId,
  );
  if (!found) throw new QualificationError("Qualificação não encontrada.");
  const lastIndex = found.data.rounds.length - 1;
  const reopens = note.roundIndex === lastIndex;
  if (!reopens) {
    throw new QualificationError(
      "Só a nota da última rodada pode ser excluída: depois dela já houve reapresentação.",
    );
  }
  const reopened: QualificationData = {
    ...found.data,
    rounds: found.data.rounds.map((r, i) =>
      i === lastIndex ? { ...r, result: "aberta" } : r,
    ),
  };
  await database.transaction(async (tx) => {
    await tx
      .update(qualificationNotes)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(qualificationNotes.id, note.id));
    await tx
      .update(qualifications)
      .set({
        data: reopened,
        status: statusOf(reopened),
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(qualifications.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.note-remove",
      targetType: "qualification-note",
      targetId: note.number,
      reason: why,
    });
  });
  return found.id;
}

/** The number of an issued note changed, with a justification. */
export async function renumberNoteWith(
  database: Database,
  tenantSlug: string,
  noteId: string,
  sequence: number,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 99_999) {
    throw new QualificationError("Número inválido.");
  }
  const note = await getNoteWith(database, tenantSlug, noteId);
  if (!note) throw new QualificationError("Nota não encontrada.");
  if (note.sequence === sequence) return;
  try {
    await database.transaction(async (tx) => {
      await tx
        .update(qualificationNotes)
        .set({ sequence })
        .where(eq(qualificationNotes.id, note.id));
      await recordAuditWith(tx as unknown as Database, {
        tenantSlug,
        actorId,
        action: "qualificacao.note-renumber",
        targetType: "qualification-note",
        targetId: `${note.number} para ${sequence}/${note.year}`,
        reason: why,
      });
    });
  } catch (error) {
    if (isPostgresError(error, UNIQUE_VIOLATION)) {
      throw new QualificationError(
        `O número ${sequence}/${note.year} já foi usado. Escolha outro.`,
      );
    }
    throw error;
  }
}

// -------------------------------------------------------------- deadlines

export async function getDeadlineSettingsWith(
  database: Database,
  tenantSlug: string,
): Promise<DeadlineSettings> {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(
        eq(tenantContent.tenantSlug, tenantSlug),
        eq(tenantContent.key, OFFICE_QUALIFICATION_KEY),
      ),
    )
    .limit(1);
  const raw = row?.published as { deadlines?: unknown } | undefined;
  return parseDeadlineSettings(raw?.deadlines);
}

/** The office's terms by attribution; an attribution left out uses the law's. */
export async function saveDeadlineSettingsWith(
  database: Database,
  tenantSlug: string,
  deadlines: DeadlineSettings,
  actorId: string,
  now = new Date(),
): Promise<void> {
  const published = { deadlines: parseDeadlineSettings(deadlines) };
  await database.transaction(async (tx) => {
    await tx
      .insert(tenantContent)
      .values({
        tenantSlug,
        key: OFFICE_QUALIFICATION_KEY,
        published,
        publishedAt: now,
        updatedBy: actorId,
      })
      .onConflictDoUpdate({
        target: [tenantContent.tenantSlug, tenantContent.key],
        set: {
          published,
          publishedAt: now,
          updatedAt: now,
          updatedBy: actorId,
        },
      });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "qualificacao.deadlines",
      targetType: "tenant-content",
      targetId: OFFICE_QUALIFICATION_KEY,
    });
  });
}

/** What the client sent with the pedido: their documents and the signed requerimento. */
const CLIENT_KINDS = ["citizen", "signed-form"];

export interface RequestDocument {
  id: string;
  displayName: string;
  mimeType: string;
  path: string;
}

/**
 * The documents the client attached to the pedido this qualification came
 * from (decision of 15/11/2026: the Assistente Virtual reads what the
 * client already sent, a new file is optional). Only files still stored:
 * one purged after the retention period is gone, and says so elsewhere.
 */
export async function requestDocumentsWith(
  database: Database,
  tenantSlug: string,
  protocol: string,
): Promise<RequestDocument[]> {
  const number = protocol.trim();
  if (!number) return [];
  const rows = await database
    .select({
      id: serviceRequestAttachments.id,
      displayName: serviceRequestAttachments.displayName,
      mimeType: serviceRequestAttachments.mimeType,
      path: serviceRequestAttachments.path,
    })
    .from(serviceRequestAttachments)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, serviceRequestAttachments.requestId),
    )
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.protocolNumber, number),
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        inArray(serviceRequestAttachments.kind, CLIENT_KINDS),
        isNull(serviceRequestAttachments.purgedAt),
      ),
    )
    .orderBy(asc(serviceRequestAttachments.createdAt));
  return rows
    .filter((r): r is typeof r & { path: string } => Boolean(r.path))
    .map(({ id, displayName, mimeType, path }) => ({
      id,
      displayName,
      mimeType,
      path,
    }));
}
