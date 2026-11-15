import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  articleIn,
  type Candidate,
  type Hit,
  metaFrom,
  metaProblems,
  rankPassages,
  type SourceArea,
  type SourceCheck,
  type SourceMeta,
  searchTerms,
  sourceWarnings,
  splitPassages,
} from "@/core/conhecimento/base.ts";
import type { Database } from "@/db/index.ts";
import {
  knowledgePassages,
  knowledgeRequests,
  knowledgeSources,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The legal base the office teaches the AI with (decision of 15/11/2026):
 * each source kept as Markdown split by article or passage, never as the
 * file. Nothing is deleted: a new import or a changed text makes a new
 * version and marks the old one; removal is a mark with a justification,
 * and can be undone.
 */

export class KnowledgeError extends Error {}

export interface SourceSummary {
  id: string;
  meta: SourceMeta;
  origin: string;
  characters: number;
  passages: number;
  createdAt: Date;
  updatedAt: Date | null;
  removedAt: Date | null;
  removedReason: string | null;
}

export interface SourceDetail extends SourceSummary {
  sections: { heading: string; text: string }[];
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const BATCH = 200;
/** The longest text one source keeps (a code with every article fits). */
export const KNOWLEDGE_MAX_CHARACTERS = 6_000_000;

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3) {
    throw new KnowledgeError("Escreva a justificativa (pelo menos 3 letras).");
  }
  return clean.slice(0, 5000);
}

function mustMeta(meta: SourceMeta): SourceMeta {
  const clean = metaFrom(meta);
  const problems = metaProblems(clean);
  if (problems.length) throw new KnowledgeError(problems.join(" "));
  return clean;
}

/**
 * A new source from its Markdown. `replaces`: the version this one takes
 * the place of (a new import of the same norm, or its text corrected),
 * which is marked and leaves the search, never deleted.
 */
export async function createSourceWith(
  database: Database,
  tenantSlug: string,
  input: {
    meta: SourceMeta;
    markdown: string;
    origin: string;
    replaces?: string;
    reason?: string;
    /** Read by the AI from an image or a scanned PDF. */
    viaAi?: boolean;
  },
  actorId: string,
): Promise<{ id: string; pending: string[] }> {
  const {
    pending: _ignored,
    check: _check,
    ...formMeta
  } = mustMeta(input.meta);
  const meta: SourceMeta = formMeta;
  const markdown = input.markdown.trim();
  if (markdown.replace(/\s+/g, "").length < 40) {
    throw new KnowledgeError("O documento não tem texto para guardar.");
  }
  if (markdown.length > KNOWLEDGE_MAX_CHARACTERS) {
    throw new KnowledgeError(
      "Texto grande demais para uma fonte só; divida em partes (por livro ou título).",
    );
  }
  const passages = splitPassages(markdown);
  const previous =
    input.replaces && isUuid(input.replaces)
      ? await getSourceRowWith(database, tenantSlug, input.replaces)
      : null;
  if (input.replaces && !previous) {
    throw new KnowledgeError("A versão anterior não foi encontrada.");
  }
  const reason = previous ? mustReason(input.reason ?? "") : undefined;
  const pending = sourceWarnings(meta, markdown, input.viaAi);
  const numbers = meta.reference.trim();
  if (!previous && numbers) {
    const twin = await database
      .select({ id: knowledgeSources.id })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.tenantSlug, tenantSlug),
          isNull(knowledgeSources.removedAt),
          sql`lower(${knowledgeSources.meta}->>'reference') = ${numbers.toLowerCase()}`,
          sql`coalesce(${knowledgeSources.meta}->>'replacedBy', '') = ''`,
        ),
      )
      .limit(1);
    if (twin.length) {
      pending.push(
        "Já existe uma fonte com esta referência. Se é o texto novo dela, envie como nova versão (Trocar o arquivo, na fonte antiga).",
      );
    }
  }
  return database.transaction(async (tx) => {
    const stored: SourceMeta = {
      ...meta,
      ...(previous ? { replaces: previous.id } : {}),
      ...(pending.length ? { pending } : {}),
    };
    const [row] = await tx
      .insert(knowledgeSources)
      .values({
        tenantSlug,
        meta: stored,
        origin: input.origin.slice(0, 1000),
        characters: markdown.length,
        createdBy: actorId,
      })
      .returning({ id: knowledgeSources.id });
    if (!row) throw new KnowledgeError("Não foi possível salvar agora.");
    for (let i = 0; i < passages.length; i += BATCH) {
      await tx.insert(knowledgePassages).values(
        passages.slice(i, i + BATCH).map((p, j) => ({
          tenantSlug,
          sourceId: row.id,
          ordinal: i + j,
          heading: p.heading.slice(0, 300),
          text: p.text,
        })),
      );
    }
    if (previous) {
      const now = new Date();
      await tx
        .update(knowledgeSources)
        .set({
          meta: { ...metaFrom(previous.meta), replacedBy: row.id },
          updatedAt: now,
          updatedBy: actorId,
        })
        .where(eq(knowledgeSources.id, previous.id));
    }
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: previous ? "knowledge.version" : "knowledge.create",
      targetType: "knowledge-source",
      targetId: row.id,
      ...(reason ? { reason } : {}),
    });
    return { id: row.id, pending };
  });
}

async function getSourceRowWith(
  database: Database,
  tenantSlug: string,
  id: string,
) {
  const [row] = await database
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.tenantSlug, tenantSlug),
        eq(knowledgeSources.id, id),
      ),
    );
  return row ?? null;
}

const toSummary = (
  row: typeof knowledgeSources.$inferSelect,
  passages: number,
): SourceSummary => ({
  id: row.id,
  meta: metaFrom(row.meta),
  origin: row.origin,
  characters: row.characters,
  passages,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  removedAt: row.removedAt,
  removedReason: row.removedReason,
});

/** The sources, newest first; the excluded ones only when asked. */
export async function listSourcesWith(
  database: Database,
  tenantSlug: string,
  options: { removed?: boolean } = {},
): Promise<SourceSummary[]> {
  const rows = await database
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.tenantSlug, tenantSlug),
        options.removed
          ? sql`${knowledgeSources.removedAt} is not null`
          : isNull(knowledgeSources.removedAt),
      ),
    )
    .orderBy(desc(knowledgeSources.createdAt));
  if (rows.length === 0) return [];
  const counts = await database
    .select({
      sourceId: knowledgePassages.sourceId,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgePassages)
    .where(
      and(
        eq(knowledgePassages.tenantSlug, tenantSlug),
        inArray(
          knowledgePassages.sourceId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .groupBy(knowledgePassages.sourceId);
  const byId = new Map(counts.map((c) => [c.sourceId, Number(c.count)]));
  return rows.map((row) => toSummary(row, byId.get(row.id) ?? 0));
}

/** A source with its text, excluded or not (the history stays readable). */
export async function getSourceWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<SourceDetail | null> {
  if (!isUuid(id)) return null;
  const row = await getSourceRowWith(database, tenantSlug, id);
  if (!row) return null;
  const sections = await database
    .select({
      heading: knowledgePassages.heading,
      text: knowledgePassages.text,
    })
    .from(knowledgePassages)
    .where(
      and(
        eq(knowledgePassages.tenantSlug, tenantSlug),
        eq(knowledgePassages.sourceId, id),
      ),
    )
    .orderBy(asc(knowledgePassages.ordinal));
  return { ...toSummary(row, sections.length), sections };
}

/** The source as one Markdown file, as it was kept. */
export function sourceMarkdown(source: SourceDetail): string {
  const m = source.meta;
  const header = [
    `<!-- ${[m.reference, m.issuer, m.date, m.status, m.url].filter(Boolean).join(" | ")} -->`,
  ];
  const body = source.sections
    .map((s) => s.text)
    .join("\n\n")
    .trim();
  const titled = body.startsWith("# ") ? body : `# ${m.title}\n\n${body}`;
  return `${header.join("\n")}\n\n${titled}\n`;
}

/** The meta corrected (title, kind, reference, status...), with a justification. */
export async function updateSourceMetaWith(
  database: Database,
  tenantSlug: string,
  id: string,
  meta: SourceMeta,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  const clean = mustMeta(meta);
  const row = isUuid(id)
    ? await getSourceRowWith(database, tenantSlug, id)
    : null;
  if (!row || row.removedAt) {
    throw new KnowledgeError("Fonte não encontrada.");
  }
  const stored = metaFrom(row.meta);
  // The version links are the system's, not the form's.
  const next: SourceMeta = {
    ...clean,
    ...(stored.replacedBy ? { replacedBy: stored.replacedBy } : {}),
    ...(stored.replaces ? { replaces: stored.replaces } : {}),
    ...(stored.check ? { check: stored.check } : {}),
    ...(stored.pending?.length ? { pending: stored.pending } : {}),
  };
  if (!next.replacedBy) delete next.replacedBy;
  if (!next.replaces) delete next.replaces;
  if (!next.check) delete next.check;
  if (!next.pending?.length) delete next.pending;
  await database.transaction(async (tx) => {
    await tx
      .update(knowledgeSources)
      .set({ meta: next, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(knowledgeSources.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "knowledge.edit",
      targetType: "knowledge-source",
      targetId: row.id,
      reason: why,
    });
  });
}

/** Excluded by a mark, with a justification; it stays kept. */
export async function removeSourceWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  const row = isUuid(id)
    ? await getSourceRowWith(database, tenantSlug, id)
    : null;
  if (!row || row.removedAt) throw new KnowledgeError("Fonte não encontrada.");
  await database.transaction(async (tx) => {
    await tx
      .update(knowledgeSources)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(knowledgeSources.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "knowledge.remove",
      targetType: "knowledge-source",
      targetId: row.id,
      reason: why,
    });
  });
}

/** An excluded source back in the base, with a justification. */
export async function restoreSourceWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  const row = isUuid(id)
    ? await getSourceRowWith(database, tenantSlug, id)
    : null;
  if (!row?.removedAt) throw new KnowledgeError("Fonte não encontrada.");
  await database.transaction(async (tx) => {
    await tx
      .update(knowledgeSources)
      .set({
        removedAt: null,
        removedBy: null,
        removedReason: null,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(knowledgeSources.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "knowledge.restore",
      targetType: "knowledge-source",
      targetId: row.id,
      reason: why,
    });
  });
}

const FOLD_FROM = "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ";
const FOLD_TO = "aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc";
const CANDIDATES = 600;

/**
 * The passages that answer the query, best first, by the hierarchy of the
 * sources: only sources in force, not excluded and not replaced by a newer
 * version; `area` narrows to one attribution (and the general sources).
 */
export async function searchKnowledgeWith(
  database: Database,
  tenantSlug: string,
  query: string,
  options: { area?: SourceArea; limit?: number } = {},
): Promise<Hit[]> {
  const terms = searchTerms(query).slice(0, 12);
  const article = articleIn(query);
  if (terms.length === 0 && !article) return [];
  const folded = sql`translate(lower(${knowledgePassages.text}), ${FOLD_FROM}, ${FOLD_TO})`;
  const matches = [
    ...terms.map((t) => sql`${folded} like ${`%${t.replace(/[%_\\]/g, "")}%`}`),
    ...(article
      ? [
          sql`lower(${knowledgePassages.heading}) like ${`art. ${article.toLowerCase()}%`}`,
        ]
      : []),
  ];
  const rows = await database
    .select({
      passageId: knowledgePassages.id,
      sourceId: knowledgePassages.sourceId,
      heading: knowledgePassages.heading,
      text: knowledgePassages.text,
      meta: knowledgeSources.meta,
    })
    .from(knowledgePassages)
    .innerJoin(
      knowledgeSources,
      eq(knowledgeSources.id, knowledgePassages.sourceId),
    )
    .where(
      and(
        eq(knowledgePassages.tenantSlug, tenantSlug),
        eq(knowledgeSources.tenantSlug, tenantSlug),
        isNull(knowledgeSources.removedAt),
        sql`coalesce(${knowledgeSources.meta}->>'replacedBy', '') = ''`,
        // Em conferência: not used until a person confirms it.
        sql`coalesce(jsonb_array_length(${knowledgeSources.meta}->'pending'), 0) = 0`,
        or(...matches),
      ),
    )
    .limit(CANDIDATES);
  const candidates: Candidate[] = [];
  for (const row of rows) {
    const meta = metaFrom(row.meta);
    if (
      options.area &&
      meta.areas.length > 0 &&
      !meta.areas.includes(options.area) &&
      !meta.areas.includes("geral")
    ) {
      continue;
    }
    candidates.push({
      sourceId: row.sourceId,
      passageId: row.passageId,
      kind: meta.kind,
      status: meta.status,
      reference: meta.reference,
      title: meta.title,
      heading: row.heading,
      text: row.text,
    });
  }
  return rankPassages(query, candidates, options.limit ?? 20);
}

/**
 * A source "em conferência" confirmed by a person: what looked wrong was
 * checked, and the source goes into use. With a justification.
 */
export async function confirmSourceWith(
  database: Database,
  tenantSlug: string,
  id: string,
  reason: string,
  actorId: string,
): Promise<void> {
  const why = mustReason(reason);
  const row = isUuid(id)
    ? await getSourceRowWith(database, tenantSlug, id)
    : null;
  if (!row || row.removedAt) throw new KnowledgeError("Fonte não encontrada.");
  const { pending: _done, ...meta } = metaFrom(row.meta);
  await database.transaction(async (tx) => {
    await tx
      .update(knowledgeSources)
      .set({ meta, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(knowledgeSources.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "knowledge.confirm",
      targetType: "knowledge-source",
      targetId: row.id,
      reason: why,
    });
  });
}

// ------------------------------------------------- the AI's requests

export interface KnowledgeRequest {
  id: string;
  topic: string;
  detail: string;
  officialUrl: string;
  sourceId: string | null;
  status: "open" | "done" | "dismissed";
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedNote: string | null;
}

/**
 * The check on the official source kept with the source; a norma changed
 * or revoked opens a request to the office ("deseja inserir o texto
 * atualizado?"), answered with a button, never a chat.
 */
export async function recordCheckWith(
  database: Database,
  tenantSlug: string,
  id: string,
  check: SourceCheck,
  actorId: string,
): Promise<{ requestId: string | null }> {
  const row = isUuid(id)
    ? await getSourceRowWith(database, tenantSlug, id)
    : null;
  if (!row || row.removedAt) throw new KnowledgeError("Fonte não encontrada.");
  const meta = metaFrom(row.meta);
  return database.transaction(async (tx) => {
    await tx
      .update(knowledgeSources)
      .set({
        meta: { ...meta, check },
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(knowledgeSources.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "ai.check",
      targetType: "knowledge-source",
      targetId: row.id,
    });
    if (check.result !== "alterada" && check.result !== "revogada") {
      return { requestId: null };
    }
    const name = meta.reference || meta.title;
    const [request] = await tx
      .insert(knowledgeRequests)
      .values({
        tenantSlug,
        topic:
          check.result === "revogada"
            ? `${name}: revogada na fonte oficial. Deseja marcar como revogada ou inserir a norma que a substituiu?`
            : `${name}: alterada na fonte oficial. Deseja inserir o texto atualizado?`,
        detail: check.summary,
        officialUrl: check.url,
        sourceId: row.id,
        createdBy: actorId,
      })
      .returning({ id: knowledgeRequests.id });
    return { requestId: request?.id ?? null };
  });
}

const toRequest = (
  row: typeof knowledgeRequests.$inferSelect,
): KnowledgeRequest => ({
  id: row.id,
  topic: row.topic,
  detail: row.detail,
  officialUrl: row.officialUrl,
  sourceId: row.sourceId,
  status:
    row.status === "done" || row.status === "dismissed" ? row.status : "open",
  createdAt: row.createdAt,
  resolvedAt: row.resolvedAt,
  resolvedNote: row.resolvedNote,
});

export async function listRequestsWith(
  database: Database,
  tenantSlug: string,
  options: { open?: boolean } = {},
): Promise<KnowledgeRequest[]> {
  const rows = await database
    .select()
    .from(knowledgeRequests)
    .where(
      and(
        eq(knowledgeRequests.tenantSlug, tenantSlug),
        options.open ? eq(knowledgeRequests.status, "open") : undefined,
      ),
    )
    .orderBy(desc(knowledgeRequests.createdAt))
    .limit(200);
  return rows.map(toRequest);
}

export async function getRequestWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<KnowledgeRequest | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(knowledgeRequests)
    .where(
      and(
        eq(knowledgeRequests.tenantSlug, tenantSlug),
        eq(knowledgeRequests.id, id),
      ),
    );
  return row ? toRequest(row) : null;
}

/** Answered: done (the text was inserted) or dismissed, with the reason. */
export async function resolveRequestWith(
  database: Database,
  tenantSlug: string,
  id: string,
  status: "done" | "dismissed",
  note: string,
  actorId: string,
): Promise<void> {
  const why =
    status === "dismissed" ? mustReason(note) : note.trim().slice(0, 5000);
  const request = await getRequestWith(database, tenantSlug, id);
  if (!request || request.status !== "open") {
    throw new KnowledgeError("Pedido não encontrado ou já respondido.");
  }
  await database.transaction(async (tx) => {
    await tx
      .update(knowledgeRequests)
      .set({
        status,
        resolvedAt: new Date(),
        resolvedBy: actorId,
        resolvedNote: why || null,
      })
      .where(eq(knowledgeRequests.id, request.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action:
        status === "done"
          ? "knowledge.request-done"
          : "knowledge.request-dismiss",
      targetType: "knowledge-request",
      targetId: request.id,
      ...(why ? { reason: why } : {}),
    });
  });
}

/**
 * A source the AI missed while qualifying a título: asked to the office as
 * a request answered by a button. Only an official address is kept.
 */
export async function createKnowledgeRequestWith(
  database: Database,
  tenantSlug: string,
  input: { topic: string; detail: string; officialUrl: string },
  actorId: string,
): Promise<string | null> {
  const topic = input.topic.trim().slice(0, 500);
  if (!topic) return null;
  const { isOfficialUrl } = await import("@/core/conhecimento/base.ts");
  const [row] = await database
    .insert(knowledgeRequests)
    .values({
      tenantSlug,
      topic: `Falta na base: ${topic}. Deseja inserir?`,
      detail: input.detail.trim().slice(0, 3000),
      officialUrl: isOfficialUrl(input.officialUrl) ? input.officialUrl : "",
      createdBy: actorId,
    })
    .returning({ id: knowledgeRequests.id });
  return row?.id ?? null;
}
