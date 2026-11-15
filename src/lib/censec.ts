import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  actOf,
  type CensecAct,
  type Central,
  isCentral,
  isQuinzena,
  quinzenaOf,
} from "@/core/censec/censec.ts";
import type { Database } from "@/db/index.ts";
import { censecActs, censecClosings } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";

/**
 * The CENSEC's acts and the quinzenas' fechamentos (CNN, arts. 265 to 272;
 * decision of 14/11/2026). The documents they were read from are never
 * kept: only the act. Edited and removed with a justification, removal by
 * a mark: nothing is deleted.
 */

export class CensecError extends Error {}

export interface StoredCensecAct {
  id: string;
  quinzena: string;
  central: Central;
  act: CensecAct;
  sourceName: string;
  createdAt: Date;
  updatedAt: Date | null;
}

/**
 * The fechamentos: the three quinzenal centrals and the CTP, monthly
 * ("fechamento único por mês", kept as the month's 2nd quinzena, as the
 * CENSEC itself takes it: "informe quinzenaReferencia com 2").
 */
export type ClosingCentral = Central | "ctp";
const isClosingCentral = (value: string): value is ClosingCentral =>
  value === "ctp" || isCentral(value);

export interface Closing {
  id: string;
  quinzena: string;
  central: ClosingCentral;
  acts: number;
  sentOn: string;
  protocol: string;
  createdAt: Date;
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3) {
    throw new CensecError("Escreva a justificativa (pelo menos 3 letras).");
  }
  return clean.slice(0, 5000);
}

/** The fortnight the act goes in: its date's, or the one chosen. */
function quinzenaFor(act: CensecAct, fallback: string): string {
  const own = quinzenaOf(act.date);
  if (own) return own;
  if (isQuinzena(fallback)) return fallback;
  throw new CensecError("Informe a data do ato para saber a quinzena.");
}

const toStored = (row: typeof censecActs.$inferSelect): StoredCensecAct => ({
  id: row.id,
  quinzena: row.quinzena,
  central: (isCentral(row.central) ? row.central : "cep") as Central,
  act: actOf(row.data as Partial<CensecAct>),
  sourceName: row.sourceName,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function createCensecActWith(
  database: Database,
  tenantSlug: string,
  act: CensecAct,
  sourceName: string,
  actorId: string,
  fallbackQuinzena = "",
): Promise<string> {
  const quinzena = quinzenaFor(act, fallbackQuinzena);
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(censecActs)
      .values({
        tenantSlug,
        quinzena,
        central: act.central,
        data: act,
        sourceName: sourceName.slice(0, 200),
        createdBy: actorId,
      })
      .returning({ id: censecActs.id });
    if (!row) throw new CensecError("Não foi possível salvar agora.");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "censec.create",
      targetType: "censec-act",
      targetId: row.id,
    });
    return row.id;
  });
}

export async function getCensecActWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredCensecAct | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(censecActs)
    .where(
      and(
        eq(censecActs.tenantSlug, tenantSlug),
        eq(censecActs.id, id),
        isNull(censecActs.removedAt),
      ),
    );
  return row ? toStored(row) : null;
}

/** The quinzena's acts, by central and date. */
export async function listCensecActsWith(
  database: Database,
  tenantSlug: string,
  quinzena: string,
): Promise<StoredCensecAct[]> {
  const rows = await database
    .select()
    .from(censecActs)
    .where(
      and(
        eq(censecActs.tenantSlug, tenantSlug),
        eq(censecActs.quinzena, quinzena),
        isNull(censecActs.removedAt),
      ),
    )
    .orderBy(
      asc(censecActs.central),
      asc(sql`${censecActs.data}->>'date'`),
      asc(censecActs.createdAt),
    );
  return rows.map(toStored);
}

/** Every quinzena with acts, newest first, and how many. */
export async function censecQuinzenasWith(
  database: Database,
  tenantSlug: string,
): Promise<{ quinzena: string; count: number }[]> {
  return database
    .select({
      quinzena: censecActs.quinzena,
      count: sql<number>`count(*)::int`,
    })
    .from(censecActs)
    .where(
      and(eq(censecActs.tenantSlug, tenantSlug), isNull(censecActs.removedAt)),
    )
    .groupBy(censecActs.quinzena)
    .orderBy(desc(censecActs.quinzena));
}

export async function updateCensecActWith(
  database: Database,
  tenantSlug: string,
  id: string,
  act: CensecAct,
  actorId: string,
  reason: string,
): Promise<string> {
  const why = mustReason(reason);
  const found = await getCensecActWith(database, tenantSlug, id);
  if (!found) throw new CensecError("Ato não encontrado.");
  const quinzena = quinzenaFor(act, found.quinzena);
  await database.transaction(async (tx) => {
    await tx
      .update(censecActs)
      .set({
        data: act,
        central: act.central,
        quinzena,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(censecActs.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "censec.edit",
      targetType: "censec-act",
      targetId: found.id,
      reason: why,
    });
  });
  return quinzena;
}

export async function removeCensecActWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<string> {
  const why = mustReason(reason);
  const found = await getCensecActWith(database, tenantSlug, id);
  if (!found) throw new CensecError("Ato não encontrado.");
  await database.transaction(async (tx) => {
    await tx
      .update(censecActs)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(censecActs.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "censec.remove",
      targetType: "censec-act",
      targetId: found.id,
      reason: why,
    });
  });
  return found.quinzena;
}

// ---------------------------------------------------------------- closings

const toClosing = (row: typeof censecClosings.$inferSelect): Closing => ({
  id: row.id,
  quinzena: row.quinzena,
  central: isClosingCentral(row.central) ? row.central : "cep",
  acts: row.acts,
  sentOn: row.sentOn,
  protocol: row.protocol,
  createdAt: row.createdAt,
});

/**
 * The fechamento done in the CENSEC: the day, its protocol and how many
 * acts went (0: the informação negativa).
 */
export async function recordClosingWith(
  database: Database,
  tenantSlug: string,
  input: {
    quinzena: string;
    central: string;
    acts: number;
    sentOn: string;
    protocol: string;
  },
  actorId: string,
): Promise<string> {
  if (!isQuinzena(input.quinzena)) throw new CensecError("Quinzena inválida.");
  if (!isClosingCentral(input.central)) {
    throw new CensecError("Escolha a central.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sentOn)) {
    throw new CensecError("Informe a data do fechamento.");
  }
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(censecClosings)
      .values({
        tenantSlug,
        quinzena: input.quinzena,
        central: input.central,
        acts: Math.max(0, Math.trunc(input.acts)),
        sentOn: input.sentOn,
        protocol: input.protocol.trim().slice(0, 120),
        createdBy: actorId,
      })
      .returning({ id: censecClosings.id });
    if (!row) throw new CensecError("Não foi possível salvar agora.");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "censec.closing",
      targetType: "censec-closing",
      targetId: row.id,
    });
    return row.id;
  });
}

export async function listClosingsWith(
  database: Database,
  tenantSlug: string,
  quinzena: string,
): Promise<Closing[]> {
  const rows = await database
    .select()
    .from(censecClosings)
    .where(
      and(
        eq(censecClosings.tenantSlug, tenantSlug),
        eq(censecClosings.quinzena, quinzena),
        isNull(censecClosings.removedAt),
      ),
    )
    .orderBy(asc(censecClosings.central), desc(censecClosings.createdAt));
  return rows.map(toClosing);
}

export async function removeClosingWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  if (!isUuid(id)) throw new CensecError("Fechamento não encontrado.");
  const [row] = await database
    .select({ id: censecClosings.id })
    .from(censecClosings)
    .where(
      and(
        eq(censecClosings.tenantSlug, tenantSlug),
        eq(censecClosings.id, id),
        isNull(censecClosings.removedAt),
      ),
    );
  if (!row) throw new CensecError("Fechamento não encontrado.");
  await database.transaction(async (tx) => {
    await tx
      .update(censecClosings)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(censecClosings.id, row.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "censec.closing-remove",
      targetType: "censec-closing",
      targetId: row.id,
      reason: why,
    });
  });
}
