import "server-only";
import { and, eq } from "drizzle-orm";
import { type Database, db } from "@/db/index.ts";
import { rcpnImports, tenantContent } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { deleteStoredFile } from "./uploads.ts";

/**
 * What the office says about each file it sent to the Registro Civil index
 * (decision of 22/11/2026: "apagar os arquivos e o sistema ficar só com as
 * informações... e a opção de excluir, editar ou apagar"):
 *
 * - the file itself can go at any time, the data read from it stays (a
 *   published or discarded import already lost its file);
 * - a name and a note of the office's own, editable, the earlier ones kept;
 * - "Apagar da lista" hides the line, never the registros: what was
 *   published stays in the index, and the line comes back with Restaurar.
 *
 * One `tenant_content` row for the office; nothing here deletes a row.
 */

const KEY = "rcpn-import-meta";

export interface ImportMeta {
  label: string;
  note: string;
  hiddenAt?: string;
  hiddenBy?: string;
  history: { label: string; note: string; at: string; by: string }[];
}

type MetaMap = Record<string, ImportMeta>;

async function readAll(database: Database, tenantSlug: string) {
  const [row] = await database
    .select({ published: tenantContent.published })
    .from(tenantContent)
    .where(
      and(eq(tenantContent.tenantSlug, tenantSlug), eq(tenantContent.key, KEY)),
    )
    .limit(1);
  const value = row?.published as { imports?: MetaMap } | null;
  return value?.imports ?? {};
}

async function writeAll(
  database: Database,
  tenantSlug: string,
  imports: MetaMap,
  actorId: string,
) {
  const value = { imports };
  await database
    .insert(tenantContent)
    .values({ tenantSlug, key: KEY, published: value, updatedBy: actorId })
    .onConflictDoUpdate({
      target: [tenantContent.tenantSlug, tenantContent.key],
      set: { published: value, updatedAt: new Date(), updatedBy: actorId },
    });
}

export function importMetaWith(
  database: Database,
  tenantSlug: string,
): Promise<MetaMap> {
  return readAll(database, tenantSlug);
}

export function importMeta(tenantSlug: string): Promise<MetaMap> {
  return readAll(db, tenantSlug);
}

const blank = (): ImportMeta => ({ label: "", note: "", history: [] });

async function importOf(database: Database, tenantSlug: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [row] = await database
    .select({
      id: rcpnImports.id,
      status: rcpnImports.status,
      storedPath: rcpnImports.storedPath,
    })
    .from(rcpnImports)
    .where(and(eq(rcpnImports.tenantSlug, tenantSlug), eq(rcpnImports.id, id)))
    .limit(1);
  return row;
}

export class ImportMetaError extends Error {}

/** A name and a note for the line; the previous ones stay in the history. */
export async function editImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  input: { label: string; note: string },
  actorId: string,
): Promise<void> {
  if (!(await importOf(database, tenantSlug, id))) {
    throw new ImportMetaError("Arquivo não encontrado.");
  }
  const all = await readAll(database, tenantSlug);
  const current = all[id] ?? blank();
  const label = input.label.trim().slice(0, 200);
  const note = input.note.trim().slice(0, 2000);
  all[id] = {
    ...current,
    label,
    note,
    history: [
      ...current.history,
      {
        label: current.label,
        note: current.note,
        at: new Date().toISOString(),
        by: actorId,
      },
    ].slice(-50),
  };
  await writeAll(database, tenantSlug, all, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.edit",
    targetType: "rcpn-import",
    targetId: id,
    reason:
      current.label || current.note ? `antes: ${current.label}` : undefined,
  });
}

/** Off the list; the registros it published stay in the index. */
export async function hideImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await importOf(database, tenantSlug, id);
  if (!row) throw new ImportMetaError("Arquivo não encontrado.");
  if (row.status === "lida" || row.status === "nao-lida") {
    throw new ImportMetaError(
      "Esta importação ainda está aberta: publique ou descarte antes de tirar da lista.",
    );
  }
  const all = await readAll(database, tenantSlug);
  all[id] = {
    ...(all[id] ?? blank()),
    hiddenAt: new Date().toISOString(),
    hiddenBy: actorId,
  };
  await writeAll(database, tenantSlug, all, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.hide",
    targetType: "rcpn-import",
    targetId: id,
  });
}

export async function restoreImportWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const all = await readAll(database, tenantSlug);
  const current = all[id];
  if (!current?.hiddenAt) return;
  const { hiddenAt: _h, hiddenBy: _b, ...rest } = current;
  all[id] = rest;
  await writeAll(database, tenantSlug, all, actorId);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.restore",
    targetType: "rcpn-import",
    targetId: id,
  });
}

/**
 * Deletes the file sent, keeping what was read from it: an open import can
 * still be checked and published, because the conference works on the data
 * read, not on the file. Already gone after publishing or discarding.
 */
export async function purgeImportFileWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<void> {
  const row = await importOf(database, tenantSlug, id);
  if (!row) throw new ImportMetaError("Arquivo não encontrado.");
  if (!row.storedPath) return;
  await database
    .update(rcpnImports)
    .set({ storedPath: null })
    .where(and(eq(rcpnImports.tenantSlug, tenantSlug), eq(rcpnImports.id, id)));
  await deleteStoredFile(row.storedPath);
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "rcpn.import.file-purge",
    targetType: "rcpn-import",
    targetId: id,
  });
}
