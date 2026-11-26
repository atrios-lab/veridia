import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { cnmsInText, formatCnm } from "@/core/ri/cnm.ts";
import type { Database } from "@/db/index.ts";
import { riProperties, riSettings } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, type HistoryEntry, RiError } from "./ri.ts";
import { sealCertificate } from "./signature/vault.ts";

/**
 * The PGV-CNM of the ONR inside the CNM tab (decision of 26/11/2026): the
 * credential of the API (Client ID and Hash, from pgv.cnm › Integrações ›
 * Acesso à API) and the import of the file the PGV gives back, which marks
 * the matrículas already there. Nothing is deleted: "apagar" the
 * credential empties it, and the audit keeps who did it and when.
 */

export interface PgvCredential {
  clientId: string;
  hasHash: boolean;
  updatedAt: Date | null;
}

export async function pgvCredentialWith(
  database: Database,
  tenantSlug: string,
): Promise<PgvCredential> {
  const [row] = await database
    .select({
      clientId: riSettings.pgvClientId,
      hash: riSettings.pgvHashSealed,
      updatedAt: riSettings.pgvUpdatedAt,
    })
    .from(riSettings)
    .where(eq(riSettings.tenantSlug, tenantSlug))
    .limit(1);
  return {
    clientId: row?.clientId ?? "",
    hasHash: Boolean(row?.hash),
    updatedAt: row?.updatedAt ?? null,
  };
}

/** Saves the Client ID and, when typed, the Hash (sealed). */
export async function savePgvCredentialWith(
  database: Database,
  tenantSlug: string,
  input: { clientId: string; hash: string; clear?: boolean },
  actor: Actor,
): Promise<void> {
  const before = await pgvCredentialWith(database, tenantSlug);
  const clientId = input.clear ? "" : input.clientId.trim().slice(0, 200);
  const hash = input.hash.trim();
  if (!input.clear) {
    if (!clientId) throw new RiError("Cole o Client ID.");
    if (!hash && !before.hasHash) throw new RiError("Cole o Hash.");
    if (hash && hash.length < 8) throw new RiError("O Hash está incompleto.");
  }
  const values: Partial<typeof riSettings.$inferInsert> = {
    pgvClientId: clientId,
    pgvUpdatedBy: actor.id,
    pgvUpdatedAt: new Date(),
  };
  if (input.clear) values.pgvHashSealed = "";
  else if (hash)
    values.pgvHashSealed = sealCertificate(Buffer.from(hash, "utf8"));
  await database
    .insert(riSettings)
    .values({ tenantSlug, ...values })
    .onConflictDoUpdate({ target: riSettings.tenantSlug, set: values });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: input.clear ? "ri.pgv-credential-clear" : "ri.pgv-credential-save",
    targetType: "ri-settings",
    targetId: null,
    reason: before.clientId
      ? `Client ID anterior: ${before.clientId}`
      : undefined,
  });
}

export interface PgvImportResult {
  found: number;
  marked: number;
  filled: number;
  already: number;
  /** CNM in the file whose matrícula is not in the acervo. */
  missing: string[];
  /** Matrículas whose CNM here differs from the PGV's (art. 333). */
  differ: { number: number; here: string; pgv: string }[];
}

/**
 * Reads the file the PGV-CNM gives back and marks the matrículas there.
 * A matrícula without CNM gets the PGV's (with history); one with a
 * different CNM is only reported, for the office to correct.
 */
export async function importPgvReturnWith(
  database: Database,
  tenant: { slug: string; cns: string },
  text: string,
  actor: Actor,
): Promise<PgvImportResult> {
  const cnms = cnmsInText(text, tenant.cns).filter((c) => c.book === 2);
  if (cnms.length === 0) {
    throw new RiError(
      "Não achei CNM desta serventia no arquivo. Confira se é o arquivo baixado do PGV-CNM.",
    );
  }
  const rows = await database
    .select()
    .from(riProperties)
    .where(
      and(
        eq(riProperties.tenantSlug, tenant.slug),
        eq(riProperties.book, 2),
        isNull(riProperties.deletedAt),
      ),
    );
  const out: PgvImportResult = {
    found: cnms.length,
    marked: 0,
    filled: 0,
    already: 0,
    missing: [],
    differ: [],
  };
  for (const c of cnms) {
    const pgv = formatCnm(
      `${c.cns}2${String(c.number).padStart(7, "0")}${c.check}`,
    );
    const row = rows.find((r) => r.number === c.number && r.recordKind !== 4);
    if (!row) {
      out.missing.push(pgv);
      continue;
    }
    const here = row.cnm ? formatCnm(row.cnm) : "";
    if (here && here !== pgv) {
      out.differ.push({ number: c.number, here, pgv });
      continue;
    }
    if (row.cnmInPgv && here) {
      out.already++;
      continue;
    }
    const history = (row.history as HistoryEntry[]) ?? [];
    await database
      .update(riProperties)
      .set({
        cnmInPgv: true,
        cnm: here || pgv,
        updatedAt: new Date(),
        history: here
          ? history
          : [
              ...history,
              {
                at: new Date().toISOString(),
                by: actor.id,
                changes: [{ field: "cnm", before: "", after: pgv }],
              },
            ],
      })
      .where(eq(riProperties.id, row.id));
    out.marked++;
    if (!here) out.filled++;
  }
  await recordAuditWith(database, {
    tenantSlug: tenant.slug,
    actorId: actor.id,
    action: "ri.pgv-import",
    targetType: "ri-property",
    targetId: null,
    reason: `${out.found} CNM no arquivo; ${out.marked} marcadas no PGV`,
  });
  return out;
}
