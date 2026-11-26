import "server-only";
import {
  and,
  desc,
  eq,
  getTableColumns,
  getTableName,
  is,
  isNotNull,
} from "drizzle-orm";
import { type PgTable, PgTable as PgTableClass } from "drizzle-orm/pg-core";
import type { Database } from "@/db/index.ts";
import * as schema from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The super admin's recovery (decision of 26/11/2026: "o super admin sempre
 * recuperar qualquer coisa apagada, excluída, editada, alterada ou
 * removida"). Every table that marks instead of deleting is found by its
 * columns: undoing the mark brings the row back; a table that keeps a
 * history of changes can have a change undone, value by value. Nothing is
 * deleted here either; every recovery goes to the audit.
 */

const FLAGS = [
  "deletedAt",
  "removedAt",
  "voidedAt",
  "withdrawnAt",
  "hiddenAt",
  "archivedAt",
] as const;
type Flag = (typeof FLAGS)[number];

const BY: Record<Flag, string> = {
  deletedAt: "deletedBy",
  removedAt: "removedBy",
  voidedAt: "voidedBy",
  withdrawnAt: "withdrawnBy",
  hiddenAt: "hiddenBy",
  archivedAt: "archivedBy",
};

const FLAG_LABEL: Record<Flag, string> = {
  deletedAt: "apagado",
  removedAt: "removido",
  voidedAt: "anulado",
  withdrawnAt: "retirado",
  hiddenAt: "ocultado",
  archivedAt: "arquivado",
};

/** Never written back when a change is undone. */
const PROTECTED = new Set([
  "id",
  "tenantSlug",
  "createdAt",
  "createdBy",
  "history",
]);

const SUMMARY = [
  "number",
  "name",
  "title",
  "label",
  "volume",
  "fileName",
  "sourceName",
  "nature",
  "presenterName",
  "text",
  "summary",
  "cue",
];

interface Entry {
  key: string;
  table: PgTable;
  name: string;
  flags: Flag[];
  history: boolean;
}

function registry(): Entry[] {
  const out: Entry[] = [];
  for (const [key, value] of Object.entries(schema)) {
    if (!is(value, PgTableClass)) continue;
    const columns = getTableColumns(value as PgTable);
    if (!("tenantSlug" in columns) || !("id" in columns)) continue;
    const flags = FLAGS.filter((f) => f in columns);
    const history = "history" in columns;
    if (flags.length || history) {
      out.push({
        key,
        table: value as PgTable,
        name: getTableName(value as PgTable).replace(/_/g, " "),
        flags,
        history,
      });
    }
  }
  return out;
}

function entryOf(key: string): Entry {
  const e = registry().find((x) => x.key === key);
  if (!e) throw new Error("Tabela não recuperável.");
  return e;
}

// biome-ignore lint/suspicious/noExplicitAny: generic access to any table's columns.
type AnyRow = Record<string, any>;

function summaryOf(row: AnyRow): string {
  for (const k of SUMMARY) {
    const v = row[k];
    if (v !== null && v !== undefined && String(v).trim()) {
      return String(v).replace(/\s+/g, " ").slice(0, 120);
    }
  }
  return String(row.id).slice(0, 8);
}

export interface RemovedItem {
  table: string;
  tableName: string;
  id: string;
  flag: Flag;
  flagLabel: string;
  at: Date;
  summary: string;
}

/** Everything marked as deleted, removed, voided… in this office. */
export async function listRemovedWith(
  database: Database,
  tenantSlug: string,
  perTable = 40,
): Promise<RemovedItem[]> {
  const items: RemovedItem[] = [];
  for (const e of registry()) {
    const columns = getTableColumns(e.table);
    for (const flag of e.flags) {
      const col = columns[flag];
      const tenant = columns.tenantSlug;
      if (!col || !tenant) continue;
      const rows = (await database
        .select()
        .from(e.table)
        .where(and(eq(tenant, tenantSlug), isNotNull(col)))
        .orderBy(desc(col))
        .limit(perTable)) as AnyRow[];
      for (const r of rows) {
        items.push({
          table: e.key,
          tableName: e.name,
          id: String(r.id),
          flag,
          flagLabel: FLAG_LABEL[flag],
          at: new Date(r[flag]),
          summary: summaryOf(r),
        });
      }
    }
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface ChangeItem {
  table: string;
  tableName: string;
  id: string;
  index: number;
  at: string;
  summary: string;
  changes: { field: string; before: unknown; after: unknown }[];
}

/** The changes kept in the history of the rows of this office. */
export async function listChangesWith(
  database: Database,
  tenantSlug: string,
  perTable = 30,
): Promise<ChangeItem[]> {
  const items: ChangeItem[] = [];
  for (const e of registry().filter((x) => x.history)) {
    const columns = getTableColumns(e.table);
    const tenant = columns.tenantSlug;
    if (!tenant) continue;
    const rows = (await database
      .select()
      .from(e.table)
      .where(eq(tenant, tenantSlug))
      .limit(500)) as AnyRow[];
    const found: ChangeItem[] = [];
    for (const r of rows) {
      const history = Array.isArray(r.history) ? r.history : [];
      history.forEach((h: AnyRow, index: number) => {
        const changes = Array.isArray(h?.changes)
          ? h.changes.filter(
              (c: AnyRow) =>
                c && typeof c.field === "string" && c.field in columns,
            )
          : [];
        if (changes.length === 0) return;
        found.push({
          table: e.key,
          tableName: e.name,
          id: String(r.id),
          index,
          at: String(h.at ?? ""),
          summary: summaryOf(r),
          changes,
        });
      });
    }
    items.push(
      ...found.sort((a, b) => b.at.localeCompare(a.at)).slice(0, perTable),
    );
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Brings a removed row back (clears the mark). */
export async function restoreRemovedWith(
  database: Database,
  tenantSlug: string,
  input: { table: string; id: string; flag: string; reason: string },
  actor: { id: string },
): Promise<void> {
  const e = entryOf(input.table);
  const flag = e.flags.find((f) => f === input.flag);
  if (!flag) throw new Error("Marca desconhecida.");
  const columns = getTableColumns(e.table);
  const set: AnyRow = { [flag]: null };
  if (BY[flag] in columns) set[BY[flag]] = null;
  const idCol = columns.id;
  const tenant = columns.tenantSlug;
  if (!idCol || !tenant) throw new Error("Tabela sem id.");
  await database
    .update(e.table)
    .set(set)
    .where(and(eq(idCol, input.id), eq(tenant, tenantSlug)));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "recovery.restore",
    targetType: e.key,
    targetId: input.id,
    reason: input.reason,
  });
}

/** Undoes one change of the history: writes back the values it replaced. */
export async function revertChangeWith(
  database: Database,
  tenantSlug: string,
  input: { table: string; id: string; index: number; reason: string },
  actor: { id: string },
): Promise<void> {
  const e = entryOf(input.table);
  if (!e.history) throw new Error("Sem histórico.");
  const columns = getTableColumns(e.table);
  const idCol = columns.id;
  const tenant = columns.tenantSlug;
  if (!idCol || !tenant) throw new Error("Tabela sem id.");
  const [row] = (await database
    .select()
    .from(e.table)
    .where(and(eq(idCol, input.id), eq(tenant, tenantSlug)))
    .limit(1)) as AnyRow[];
  if (!row) throw new Error("Registro não encontrado.");
  const history: AnyRow[] = Array.isArray(row.history) ? row.history : [];
  const entry = history[input.index];
  if (!entry?.changes) throw new Error("Alteração não encontrada.");
  const set: AnyRow = {};
  const undone: AnyRow[] = [];
  for (const c of entry.changes as AnyRow[]) {
    if (!(c.field in columns) || PROTECTED.has(c.field)) continue;
    set[c.field] = c.before ?? null;
    undone.push({
      field: c.field,
      before: row[c.field],
      after: c.before ?? null,
    });
  }
  if (undone.length === 0) throw new Error("Nada a desfazer nesta alteração.");
  set.history = [
    ...history,
    {
      at: new Date().toISOString(),
      by: actor.id,
      what: "alteração desfeita pelo super admin",
      changes: undone,
    },
  ];
  await database
    .update(e.table)
    .set(set)
    .where(and(eq(idCol, input.id), eq(tenant, tenantSlug)));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "recovery.revert",
    targetType: e.key,
    targetId: input.id,
    reason: input.reason,
  });
}
