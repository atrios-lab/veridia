import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  applyHabilitacao,
  type HabilitacaoChange,
  type HabilitacaoValues,
  processoNumber,
} from "@/core/rcpn/habilitacao.ts";
import { officeYear } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import { type Database, db } from "@/db/index.ts";
import { rcpnHabilitacaoChanges, rcpnHabilitacoes } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { nextNumberWith } from "./document-numbering.ts";

/**
 * The processos de habilitação para o casamento (change
 * habilitacao-de-casamento): opened with the year's number, corrected with
 * a justification, canceled and restored by a mark ("nunca apague").
 * Every act keeps its fields before and after and goes to the audit.
 */

export class HabilitacaoError extends Error {}

export type HabilitacaoHistoryKind =
  | "abertura"
  | "edicao"
  | "edital"
  | "cancelamento"
  | "estorno";

export interface Habilitacao {
  id: string;
  number: string;
  year: number;
  sequence: number;
  values: HabilitacaoValues;
  publicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: Date | null;
  cancelReason: string;
}

export interface HabilitacaoWithHistory extends Habilitacao {
  history: {
    id: string;
    kind: HabilitacaoHistoryKind;
    reason: string;
    changes: HabilitacaoChange[];
    /** The person's name; "" for the platform's own account. */
    actorName: string;
    createdAt: Date;
  }[];
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

function toHabilitacao(row: typeof rcpnHabilitacoes.$inferSelect): Habilitacao {
  return {
    id: row.id,
    number: processoNumber(row.year, row.sequence),
    year: row.year,
    sequence: row.sequence,
    values: (row.fields ?? {}) as HabilitacaoValues,
    publicationId: row.publicationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canceledAt: row.canceledAt,
    cancelReason: row.cancelReason ?? "",
  };
}

const MIN_REASON = 3;

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < MIN_REASON) {
    throw new HabilitacaoError(
      "Escreva a justificativa (pelo menos 3 letras).",
    );
  }
  return clean.slice(0, 5000);
}

const ATTEMPTS = 5;

/** Opens a processo with the next number of the year. Returns its id. */
export async function createHabilitacaoWith(
  database: Database,
  tenantSlug: string,
  typed: Record<string, string>,
  actorId: string,
  now = new Date(),
): Promise<string> {
  const { values, changes, problems } = applyHabilitacao({}, typed);
  if (problems.length > 0) throw new HabilitacaoError(problems.join(" "));
  if (!values["n1.nome"] && !values["n2.nome"]) {
    throw new HabilitacaoError("Informe pelo menos o nome de um dos nubentes.");
  }
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    const sequence = await nextNumberWith(
      database,
      tenantSlug,
      "habilitacao",
      year,
    );
    try {
      return await database.transaction(async (tx) => {
        const [row] = await tx
          .insert(rcpnHabilitacoes)
          .values({
            tenantSlug,
            year,
            sequence,
            fields: values,
            createdBy: actorId,
          })
          .returning({ id: rcpnHabilitacoes.id });
        if (!row)
          throw new HabilitacaoError(
            "Não foi possível abrir o processo agora.",
          );
        await tx.insert(rcpnHabilitacaoChanges).values({
          tenantSlug,
          habilitacaoId: row.id,
          kind: "abertura",
          changes,
          actorId,
        });
        await recordAuditWith(tx as unknown as Database, {
          tenantSlug,
          actorId,
          action: "rcpn.habilitacao.create",
          targetType: "rcpn-habilitacao",
          targetId: processoNumber(year, sequence),
        });
        return row.id;
      });
    } catch (error) {
      if (isPostgresError(error, UNIQUE_VIOLATION) && attempt < ATTEMPTS)
        continue;
      throw error;
    }
  }
}

export async function getHabilitacaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<HabilitacaoWithHistory | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(rcpnHabilitacoes)
    .where(
      and(
        eq(rcpnHabilitacoes.tenantSlug, tenantSlug),
        eq(rcpnHabilitacoes.id, id),
      ),
    );
  if (!row) return null;
  const history = await database
    .select()
    .from(rcpnHabilitacaoChanges)
    .where(eq(rcpnHabilitacaoChanges.habilitacaoId, row.id))
    .orderBy(desc(rcpnHabilitacaoChanges.createdAt))
    .limit(200);
  const actorIds = [...new Set(history.map((h) => h.actorId))];
  // The Átrios account leaves no name behind (decision of 13/11/2026).
  const names = new Map(
    actorIds.length
      ? (
          await database
            .select({ id: user.id, name: user.name, role: user.role })
            .from(user)
            .where(inArray(user.id, actorIds))
        )
          .filter((person) => person.role !== "superadmin")
          .map((person) => [person.id, person.name])
      : [],
  );
  return {
    ...toHabilitacao(row),
    history: history.map((h) => ({
      id: h.id,
      kind: h.kind as HabilitacaoHistoryKind,
      reason: h.reason,
      changes: (h.changes ?? []) as HabilitacaoChange[],
      actorName: names.get(h.actorId) ?? "",
      createdAt: h.createdAt,
    })),
  };
}

/** The office's processos, newest first. */
export async function listHabilitacoesWith(
  database: Database,
  tenantSlug: string,
): Promise<Habilitacao[]> {
  const rows = await database
    .select()
    .from(rcpnHabilitacoes)
    .where(eq(rcpnHabilitacoes.tenantSlug, tenantSlug))
    .orderBy(desc(rcpnHabilitacoes.year), desc(rcpnHabilitacoes.sequence))
    .limit(500);
  return rows.map(toHabilitacao);
}

async function mustGet(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<HabilitacaoWithHistory> {
  const found = await getHabilitacaoWith(database, tenantSlug, id);
  if (!found)
    throw new HabilitacaoError("Processo de habilitação não encontrado.");
  return found;
}

/**
 * Saves the typed fields over the processo. Returns how many changed
 * (0: nothing to save). A canceled processo is restored before it changes.
 */
export async function saveHabilitacaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  typed: Record<string, string>,
  actorId: string,
  reason: string,
): Promise<number> {
  const why = mustReason(reason);
  const found = await mustGet(database, tenantSlug, id);
  if (found.canceledAt) {
    throw new HabilitacaoError(
      "Este processo está cancelado. Estorne o cancelamento para alterar.",
    );
  }
  const { values, changes, problems } = applyHabilitacao(found.values, typed);
  if (problems.length > 0) throw new HabilitacaoError(problems.join(" "));
  if (changes.length === 0) return 0;
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnHabilitacoes)
      .set({ fields: values, updatedAt: new Date() })
      .where(eq(rcpnHabilitacoes.id, found.id));
    await tx.insert(rcpnHabilitacaoChanges).values({
      tenantSlug,
      habilitacaoId: found.id,
      kind: "edicao",
      reason: why,
      changes,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.habilitacao.edit",
      targetType: "rcpn-habilitacao",
      targetId: found.number,
      reason: why,
    });
  });
  return changes.length;
}

/**
 * The edital published on the site: the publication is kept with the
 * processo and, if the date was blank, the edital's date becomes `on`.
 */
export async function markEditalWith(
  database: Database,
  tenantSlug: string,
  id: string,
  publicationId: string,
  on: string,
  actorId: string,
): Promise<void> {
  const found = await mustGet(database, tenantSlug, id);
  const before = found.values.editalEm ?? "";
  const after = before || on;
  const values = { ...found.values, editalEm: after };
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnHabilitacoes)
      .set({ fields: values, publicationId, updatedAt: new Date() })
      .where(eq(rcpnHabilitacoes.id, found.id));
    await tx.insert(rcpnHabilitacaoChanges).values({
      tenantSlug,
      habilitacaoId: found.id,
      kind: "edital",
      reason: "Edital de proclamas publicado no site da serventia.",
      changes:
        before === after
          ? []
          : [{ key: "editalEm", label: "Edital publicado em", before, after }],
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.habilitacao.edital",
      targetType: "rcpn-habilitacao",
      targetId: found.number,
    });
  });
}

export async function cancelHabilitacaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const found = await mustGet(database, tenantSlug, id);
  if (found.canceledAt)
    throw new HabilitacaoError("Este processo já está cancelado.");
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnHabilitacoes)
      .set({ canceledAt: new Date(), canceledBy: actorId, cancelReason: why })
      .where(eq(rcpnHabilitacoes.id, found.id));
    await tx.insert(rcpnHabilitacaoChanges).values({
      tenantSlug,
      habilitacaoId: found.id,
      kind: "cancelamento",
      reason: why,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.habilitacao.cancel",
      targetType: "rcpn-habilitacao",
      targetId: found.number,
      reason: why,
    });
  });
}

export async function restoreHabilitacaoWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const found = await mustGet(database, tenantSlug, id);
  if (!found.canceledAt)
    throw new HabilitacaoError("Este processo não está cancelado.");
  await database.transaction(async (tx) => {
    await tx
      .update(rcpnHabilitacoes)
      .set({ canceledAt: null, canceledBy: null, cancelReason: null })
      .where(eq(rcpnHabilitacoes.id, found.id));
    await tx.insert(rcpnHabilitacaoChanges).values({
      tenantSlug,
      habilitacaoId: found.id,
      kind: "estorno",
      reason: why,
      actorId,
    });
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "rcpn.habilitacao.restore",
      targetType: "rcpn-habilitacao",
      targetId: found.number,
      reason: why,
    });
  });
}

/** The production database, for the pages and actions. */
export const habilitacoes = {
  create: (
    tenantSlug: string,
    typed: Record<string, string>,
    actorId: string,
  ) => createHabilitacaoWith(db, tenantSlug, typed, actorId),
  get: (tenantSlug: string, id: string) =>
    getHabilitacaoWith(db, tenantSlug, id),
  list: (tenantSlug: string) => listHabilitacoesWith(db, tenantSlug),
  save: (
    tenantSlug: string,
    id: string,
    typed: Record<string, string>,
    actorId: string,
    reason: string,
  ) => saveHabilitacaoWith(db, tenantSlug, id, typed, actorId, reason),
  markEdital: (
    tenantSlug: string,
    id: string,
    publicationId: string,
    on: string,
    actorId: string,
  ) => markEditalWith(db, tenantSlug, id, publicationId, on, actorId),
  cancel: (tenantSlug: string, id: string, actorId: string, reason: string) =>
    cancelHabilitacaoWith(db, tenantSlug, id, actorId, reason),
  restore: (tenantSlug: string, id: string, actorId: string, reason: string) =>
    restoreHabilitacaoWith(db, tenantSlug, id, actorId, reason),
};
