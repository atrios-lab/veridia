import "server-only";
import { and, desc, eq } from "drizzle-orm";
import {
  type PickupDocumentType,
  type PickupInput,
  PickupInputSchema,
  type PickupRecord,
  type PickupRelation,
} from "@/core/request/pickup.ts";
import { type Database, db } from "@/db/index.ts";
import { serviceRequestPickups, serviceRequests } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { updateRequestStatusWith } from "./service-request.ts";

/**
 * Who picked up the document at the counter (decision of 19/11/2026).
 * Registering it closes the request in the same step. Nothing is deleted or
 * edited: a correction is a new row, and the latest one is the one read.
 */

export class PickupError extends Error {}

function toRecord(
  row: typeof serviceRequestPickups.$inferSelect,
): PickupRecord {
  return {
    id: row.id,
    personName: row.personName,
    relation: row.relation as PickupRelation,
    documentType: row.documentType as PickupDocumentType,
    documentNumber: row.documentNumber,
    note: row.note,
    pickedUpAt: row.pickedUpAt.toISOString(),
    registeredBy: row.registeredBy,
  };
}

/** The latest pickup registered for a request, or null. */
export async function latestPickupWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<PickupRecord | null> {
  const [row] = await database
    .select()
    .from(serviceRequestPickups)
    .where(
      and(
        eq(serviceRequestPickups.tenantSlug, tenantSlug),
        eq(serviceRequestPickups.requestId, requestId),
      ),
    )
    .orderBy(desc(serviceRequestPickups.pickedUpAt))
    .limit(1);
  return row ? toRecord(row) : null;
}

export async function latestPickup(
  tenantSlug: string,
  requestId: string,
): Promise<PickupRecord | null> {
  return latestPickupWith(db, tenantSlug, requestId);
}

/**
 * Registers who picked up the document and closes the request (andamento
 * "Concluído"). Only a request waiting for the pickup can be closed this
 * way: the way there is "Aguardando retirada no balcão".
 */
export async function registerPickupWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  raw: unknown,
  actorId: string,
): Promise<PickupRecord> {
  const parsed = PickupInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PickupError(
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
    );
  }
  const input: PickupInput = parsed.data;
  const [request] = await database
    .select({ id: serviceRequests.id, status: serviceRequests.status })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    )
    .limit(1);
  if (!request) throw new PickupError("Pedido não encontrado.");
  if (request.status !== "ready-for-pickup") {
    throw new PickupError(
      "A retirada só se registra com o pedido aguardando retirada no balcão.",
    );
  }
  const [row] = await database
    .insert(serviceRequestPickups)
    .values({
      tenantSlug,
      requestId,
      personName: input.personName,
      relation: input.relation,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      note: input.note,
      registeredBy: actorId,
    })
    .returning();
  if (!row) throw new PickupError("Não foi possível registrar a retirada.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "service-request.pickup",
    targetType: "service-request",
    targetId: requestId,
  });
  await updateRequestStatusWith(
    database,
    tenantSlug,
    requestId,
    "done",
    actorId,
  );
  return toRecord(row);
}
