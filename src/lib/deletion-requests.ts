import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { OFFICIAL_KINDS, type OfficialKind } from "@/core/deletion/official.ts";
import type { Database } from "@/db/index.ts";
import {
  deletionRequests,
  riActs,
  riBooks,
  riOnrImages,
  riProperties,
  riProtocols,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { setActDeletedWith, setPropertyDeletedWith } from "./ri.ts";
import { setBookDeletedWith } from "./ri-books.ts";
import { setOnrImageDeletedWith } from "./ri-onr-images.ts";
import { setProtocolVoidedWith } from "./ri-protocols.ts";

/**
 * Deletions of official documents asked by the staff and decided by the
 * Tabelião. Approving runs the usual deletion (a mark, never a removed
 * row) with the requester's reason; refusing keeps the document and says
 * why. Nothing here is deleted: the request keeps its status.
 */

export class DeletionRequestError extends Error {}

export type DeletionRequestRow = typeof deletionRequests.$inferSelect;

/** "Matrícula nº 002", "Ato R-3 da matrícula nº 002"…, read from the bank. */
export async function labelForWith(
  database: Database,
  tenantSlug: string,
  kind: OfficialKind,
  id: string,
): Promise<string> {
  const n = (v: number) => String(v).padStart(3, "0");
  try {
    if (kind === "ri-property") {
      const [r] = await database
        .select({ number: riProperties.number, book: riProperties.book })
        .from(riProperties)
        .where(
          and(eq(riProperties.tenantSlug, tenantSlug), eq(riProperties.id, id)),
        );
      if (r)
        return r.book === 3
          ? `Registro nº ${n(r.number)} do Livro 3`
          : `Matrícula nº ${n(r.number)}`;
    }
    if (kind === "ri-act") {
      const [r] = await database
        .select({
          kind: riActs.kind,
          seq: riActs.seq,
          number: riProperties.number,
        })
        .from(riActs)
        .innerJoin(riProperties, eq(riProperties.id, riActs.propertyId))
        .where(and(eq(riActs.tenantSlug, tenantSlug), eq(riActs.id, id)));
      if (r) return `Ato ${r.kind}-${r.seq} da matrícula nº ${n(r.number)}`;
    }
    if (kind === "ri-protocol") {
      const [r] = await database
        .select({ number: riProtocols.number })
        .from(riProtocols)
        .where(
          and(eq(riProtocols.tenantSlug, tenantSlug), eq(riProtocols.id, id)),
        );
      if (r) return `Protocolo nº ${r.number.toLocaleString("pt-BR")}`;
    }
    if (kind === "ri-book") {
      const [r] = await database
        .select({ volume: riBooks.volume })
        .from(riBooks)
        .where(and(eq(riBooks.tenantSlug, tenantSlug), eq(riBooks.id, id)));
      if (r) return `Livro nº ${r.volume}`;
    }
    if (kind === "ri-onr-image") {
      const [r] = await database
        .select({ number: riOnrImages.number })
        .from(riOnrImages)
        .where(
          and(eq(riOnrImages.tenantSlug, tenantSlug), eq(riOnrImages.id, id)),
        );
      if (r) return `Imagem da matrícula nº ${n(r.number)} para a ONR`;
    }
  } catch {
    // An id that is not a uuid: fall back to the label given.
  }
  return "";
}

export async function requestDeletionWith(
  database: Database,
  tenantSlug: string,
  input: {
    /** An official kind, or the key of any other deletion of the platform. */
    kind: string;
    targetId: string;
    label: string;
    reason: string;
    /** The form to replay on approval (any other deletion). */
    payload?: [string, string][];
  },
  actor: { id: string },
): Promise<void> {
  const open = await database
    .select({ id: deletionRequests.id })
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.tenantSlug, tenantSlug),
        eq(deletionRequests.kind, input.kind),
        eq(deletionRequests.targetId, input.targetId),
        eq(deletionRequests.status, "pendente"),
      ),
    )
    .limit(1);
  if (open.length && input.targetId) {
    throw new DeletionRequestError(
      "Já existe um pedido de exclusão deste documento esperando o Tabelião.",
    );
  }
  await database.insert(deletionRequests).values({
    tenantSlug,
    kind: input.kind,
    targetId: input.targetId,
    label: (
      (input.kind in OFFICIAL_KINDS
        ? await labelForWith(
            database,
            tenantSlug,
            input.kind as OfficialKind,
            input.targetId,
          )
        : "") || input.label
    ).slice(0, 300),
    payload: input.payload ?? null,
    reason: input.reason.slice(0, 5000),
    requestedBy: actor.id,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "deletion.request",
    targetType: input.kind,
    targetId: input.targetId,
    reason: input.reason,
  });
}

export async function listDeletionRequestsWith(
  database: Database,
  tenantSlug: string,
): Promise<DeletionRequestRow[]> {
  return database
    .select()
    .from(deletionRequests)
    .where(eq(deletionRequests.tenantSlug, tenantSlug))
    .orderBy(desc(deletionRequests.requestedAt))
    .limit(300);
}

export async function pendingDeletionCountWith(
  database: Database,
  tenantSlug: string,
): Promise<number> {
  const rows = await database
    .select({ id: deletionRequests.id })
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.tenantSlug, tenantSlug),
        eq(deletionRequests.status, "pendente"),
      ),
    );
  return rows.length;
}

async function execute(
  database: Database,
  tenantSlug: string,
  row: DeletionRequestRow,
  actor: { id: string },
) {
  const kind = row.kind as OfficialKind;
  switch (kind) {
    case "ri-property":
      return setPropertyDeletedWith(
        database,
        tenantSlug,
        row.targetId,
        true,
        actor,
      );
    case "ri-act":
      return setActDeletedWith(database, tenantSlug, row.targetId, true, actor);
    case "ri-protocol":
      return setProtocolVoidedWith(
        database,
        tenantSlug,
        row.targetId,
        true,
        row.reason,
        actor,
      );
    case "ri-book":
      return setBookDeletedWith(
        database,
        tenantSlug,
        row.targetId,
        true,
        actor,
      );
    case "ri-onr-image":
      return setOnrImageDeletedWith(
        database,
        tenantSlug,
        row.targetId,
        true,
        actor,
        row.reason,
      );
    default:
      throw new DeletionRequestError(
        `Tipo de documento desconhecido: ${OFFICIAL_KINDS[kind] ?? row.kind}.`,
      );
  }
}

/** The Tabelião approves (runs the deletion) or refuses, with a note. */
export async function decideDeletionWith(
  database: Database,
  tenantSlug: string,
  id: string,
  approve: boolean,
  note: string,
  actor: { id: string },
  /** Runs any other deletion (the form replayed); throws when it fails. */
  replay?: (row: DeletionRequestRow) => Promise<void>,
): Promise<DeletionRequestRow> {
  const [row] = await database
    .select()
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.tenantSlug, tenantSlug),
        eq(deletionRequests.id, id),
      ),
    )
    .limit(1);
  if (!row) throw new DeletionRequestError("Pedido não encontrado.");
  if (row.status !== "pendente") {
    throw new DeletionRequestError("Este pedido já foi decidido.");
  }
  if (approve) {
    if (row.kind in OFFICIAL_KINDS) {
      await execute(database, tenantSlug, row, actor);
    } else if (replay) {
      await replay(row);
    } else {
      throw new DeletionRequestError("Não há como executar este pedido.");
    }
  }
  await database
    .update(deletionRequests)
    .set({
      status: approve ? "aprovado" : "recusado",
      decidedBy: actor.id,
      decidedAt: new Date(),
      decisionNote: note.trim().slice(0, 5000),
    })
    .where(eq(deletionRequests.id, row.id));
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: approve ? "deletion.approve" : "deletion.refuse",
    targetType: row.kind,
    targetId: row.targetId,
    reason: note.trim() || row.reason,
  });
  return row;
}
