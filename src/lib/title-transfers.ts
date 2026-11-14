import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { officeYear } from "@/core/time/office-time.ts";
import {
  competenceOf,
  isChannel,
  type TitleTransfer,
  transferProblems,
} from "@/core/titularidade/titularidade.ts";
import { isPostgresError, UNIQUE_VIOLATION } from "@/db/errors.ts";
import type { Database } from "@/db/index.ts";
import { titleTransferFilings, titleTransfers } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { nextNumberWith } from "./document-numbering.ts";

/**
 * The acts that changed the ownership of imóveis and the month's ofício to
 * the prefeitura (CNN, art. 184-A; decision of 14/11/2026). Edited and
 * removed with a justification, removal by a mark: nothing is deleted.
 */

export class TitularidadeError extends Error {}

export interface StoredTransfer {
  id: string;
  competence: string;
  transfer: TitleTransfer;
  sourceName: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface Filing {
  id: string;
  number: string;
  competence: string;
  transfers: TitleTransfer[];
  issuedOn: string;
  sentOn: string;
  channel: string;
  receipt: string;
  receiptPath: string | null;
  receiptName: string | null;
  semutOn: string;
  semutReceipt: string;
  createdAt: Date;
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

function mustReason(reason: string): string {
  const clean = reason.trim();
  if (clean.length < 3) {
    throw new TitularidadeError(
      "Escreva a justificativa (pelo menos 3 letras).",
    );
  }
  return clean.slice(0, 5000);
}

function mustBeComplete(transfer: TitleTransfer): void {
  const problems = transferProblems(transfer);
  if (problems.length > 0) throw new TitularidadeError(problems.join(" "));
}

const toStored = (row: typeof titleTransfers.$inferSelect): StoredTransfer => ({
  id: row.id,
  competence: row.competence,
  transfer: row.data as TitleTransfer,
  sourceName: row.sourceName,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function createTransferWith(
  database: Database,
  tenantSlug: string,
  transfer: TitleTransfer,
  sourceName: string,
  actorId: string,
): Promise<string> {
  mustBeComplete(transfer);
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(titleTransfers)
      .values({
        tenantSlug,
        competence: competenceOf(transfer.actDate),
        data: transfer,
        sourceName: sourceName.slice(0, 200),
        createdBy: actorId,
      })
      .returning({ id: titleTransfers.id });
    if (!row) throw new TitularidadeError("Não foi possível salvar agora.");
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "titularidade.create",
      targetType: "title-transfer",
      targetId: row.id,
    });
    return row.id;
  });
}

export async function getTransferWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<StoredTransfer | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(titleTransfers)
    .where(
      and(
        eq(titleTransfers.tenantSlug, tenantSlug),
        eq(titleTransfers.id, id),
        isNull(titleTransfers.removedAt),
      ),
    );
  return row ? toStored(row) : null;
}

/** The acts of a competence, in the order they were done. */
export async function listTransfersWith(
  database: Database,
  tenantSlug: string,
  competence: string,
): Promise<StoredTransfer[]> {
  const rows = await database
    .select()
    .from(titleTransfers)
    .where(
      and(
        eq(titleTransfers.tenantSlug, tenantSlug),
        eq(titleTransfers.competence, competence),
        isNull(titleTransfers.removedAt),
      ),
    )
    .orderBy(
      asc(sql`${titleTransfers.data}->>'actDate'`),
      asc(titleTransfers.createdAt),
    );
  return rows.map(toStored);
}

/** Every competence with acts, newest first, and how many. */
export async function competencesWith(
  database: Database,
  tenantSlug: string,
): Promise<{ competence: string; count: number }[]> {
  const rows = await database
    .select({
      competence: titleTransfers.competence,
      count: sql<number>`count(*)::int`,
    })
    .from(titleTransfers)
    .where(
      and(
        eq(titleTransfers.tenantSlug, tenantSlug),
        isNull(titleTransfers.removedAt),
      ),
    )
    .groupBy(titleTransfers.competence)
    .orderBy(desc(titleTransfers.competence));
  return rows;
}

export async function updateTransferWith(
  database: Database,
  tenantSlug: string,
  id: string,
  transfer: TitleTransfer,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  mustBeComplete(transfer);
  const found = await getTransferWith(database, tenantSlug, id);
  if (!found) throw new TitularidadeError("Ato não encontrado.");
  await database.transaction(async (tx) => {
    await tx
      .update(titleTransfers)
      .set({
        data: transfer,
        competence: competenceOf(transfer.actDate),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(titleTransfers.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "titularidade.edit",
      targetType: "title-transfer",
      targetId: found.id,
      reason: why,
    });
  });
}

export async function removeTransferWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const found = await getTransferWith(database, tenantSlug, id);
  if (!found) throw new TitularidadeError("Ato não encontrado.");
  await database.transaction(async (tx) => {
    await tx
      .update(titleTransfers)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(titleTransfers.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "titularidade.remove",
      targetType: "title-transfer",
      targetId: found.id,
      reason: why,
    });
  });
}

// ---------------------------------------------------------------- ofícios

const toFiling = (row: typeof titleTransferFilings.$inferSelect): Filing => ({
  id: row.id,
  number: formatGuideNumber(row.year, row.sequence),
  competence: row.competence,
  transfers: (row.transfers ?? []) as TitleTransfer[],
  issuedOn: row.issuedOn,
  sentOn: row.sentOn,
  channel: row.channel,
  receipt: row.receipt,
  receiptPath: row.receiptPath,
  receiptName: row.receiptName,
  semutOn: row.semutOn,
  semutReceipt: row.semutReceipt,
  createdAt: row.createdAt,
});

/**
 * The month's ofício: numbered, with the acts as they stand now (an empty
 * month makes the "sem movimento" ofício). Returns its id.
 */
export async function createFilingWith(
  database: Database,
  tenantSlug: string,
  competence: string,
  issuedOn: string,
  actorId: string,
  now = new Date(),
): Promise<string> {
  if (!/^\d{4}-\d{2}$/.test(competence)) {
    throw new TitularidadeError("Escolha o mês da comunicação.");
  }
  const transfers = (
    await listTransfersWith(database, tenantSlug, competence)
  ).map((s) => s.transfer);
  const year = officeYear(now);
  for (let attempt = 1; ; attempt++) {
    const sequence = await nextNumberWith(
      database,
      tenantSlug,
      "titularidade",
      year,
    );
    try {
      return await database.transaction(async (tx) => {
        const [row] = await tx
          .insert(titleTransferFilings)
          .values({
            tenantSlug,
            competence,
            year,
            sequence,
            transfers,
            issuedOn,
            createdBy: actorId,
          })
          .returning({ id: titleTransferFilings.id });
        if (!row)
          throw new TitularidadeError("Não foi possível gerar o ofício agora.");
        await recordAuditWith(tx as unknown as Database, {
          tenantSlug,
          actorId,
          action: "titularidade.filing",
          targetType: "title-transfer-filing",
          targetId: formatGuideNumber(year, sequence),
        });
        return row.id;
      });
    } catch (error) {
      if (isPostgresError(error, UNIQUE_VIOLATION) && attempt < 5) continue;
      throw error;
    }
  }
}

export async function listFilingsWith(
  database: Database,
  tenantSlug: string,
): Promise<Filing[]> {
  const rows = await database
    .select()
    .from(titleTransferFilings)
    .where(
      and(
        eq(titleTransferFilings.tenantSlug, tenantSlug),
        isNull(titleTransferFilings.removedAt),
      ),
    )
    .orderBy(
      desc(titleTransferFilings.year),
      desc(titleTransferFilings.sequence),
    )
    .limit(200);
  return rows.map(toFiling);
}

export async function getFilingWith(
  database: Database,
  tenantSlug: string,
  id: string,
): Promise<Filing | null> {
  if (!isUuid(id)) return null;
  const [row] = await database
    .select()
    .from(titleTransferFilings)
    .where(
      and(
        eq(titleTransferFilings.tenantSlug, tenantSlug),
        eq(titleTransferFilings.id, id),
        isNull(titleTransferFilings.removedAt),
      ),
    );
  return row ? toFiling(row) : null;
}

export interface Sending {
  sentOn: string;
  channel: string;
  receipt: string;
  /** The receipt itself, when attached (stored file). */
  receiptFile?: { path: string; name: string };
  /** The signed ofício delivered to the SEMUT too (optional). */
  semutOn?: string;
  semutReceipt?: string;
}

/**
 * The electronic sending with its receipt of delivery (CNN, art. 184-A,
 * § 2º): the platform and the receipt's number are required; the receipt
 * file and the delivery to the SEMUT are optional.
 */
export async function markSentWith(
  database: Database,
  tenantSlug: string,
  id: string,
  sending: Sending,
  actorId: string,
): Promise<void> {
  const found = await getFilingWith(database, tenantSlug, id);
  if (!found) throw new TitularidadeError("Ofício não encontrado.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sending.sentOn)) {
    throw new TitularidadeError("Informe a data do envio.");
  }
  if (!isChannel(sending.channel)) {
    throw new TitularidadeError(
      "Escolha a plataforma: o envio é eletrônico, à plataforma do CNB/CF (Notas) ou do ONR (Registro de Imóveis) (Código Nacional de Normas, art. 184-A, § 2º).",
    );
  }
  if (sending.receipt.trim().length < 3) {
    throw new TitularidadeError(
      "Informe o número do recibo de entrega que a plataforma deu (art. 184-A, § 2º).",
    );
  }
  const semutOn = sending.semutOn?.trim() ?? "";
  if (semutOn && !/^\d{4}-\d{2}-\d{2}$/.test(semutOn)) {
    throw new TitularidadeError("Data da entrega à SEMUT inválida.");
  }
  await database.transaction(async (tx) => {
    await tx
      .update(titleTransferFilings)
      .set({
        sentOn: sending.sentOn,
        channel: sending.channel,
        receipt: sending.receipt.trim().slice(0, 300),
        ...(sending.receiptFile
          ? {
              receiptPath: sending.receiptFile.path,
              receiptName: sending.receiptFile.name.slice(0, 200),
            }
          : {}),
        semutOn,
        semutReceipt: (sending.semutReceipt ?? "").trim().slice(0, 300),
      })
      .where(eq(titleTransferFilings.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "titularidade.sent",
      targetType: "title-transfer-filing",
      targetId: found.number,
    });
  });
}

export async function removeFilingWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
  reason: string,
): Promise<void> {
  const why = mustReason(reason);
  const found = await getFilingWith(database, tenantSlug, id);
  if (!found) throw new TitularidadeError("Ofício não encontrado.");
  await database.transaction(async (tx) => {
    await tx
      .update(titleTransferFilings)
      .set({ removedAt: new Date(), removedBy: actorId, removedReason: why })
      .where(eq(titleTransferFilings.id, found.id));
    await recordAuditWith(tx as unknown as Database, {
      tenantSlug,
      actorId,
      action: "titularidade.filing-remove",
      targetType: "title-transfer-filing",
      targetId: found.number,
      reason: why,
    });
  });
}
