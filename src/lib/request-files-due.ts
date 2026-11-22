import "server-only";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { and, desc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import JSZip from "jszip";
import {
  REQUEST_FILE_RETENTION_DAYS,
  REQUEST_FILE_WARNING_DAYS,
  requestFileDueSoon,
  requestFileServable,
} from "@/core/request/attachment-retention.ts";
import type { IsoDate } from "@/core/scheduling/calendar.ts";
import { type Database, db } from "@/db/index.ts";
import {
  auditLog,
  serviceRequestAttachments,
  serviceRequests,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { requestFileStatusOf } from "./service-request.ts";

/**
 * The daily reminder before a closed protocol's files are deleted (decision
 * of 22/11/2026: "lembrar 10 dias com antecedência, todo dia nesses 10 dias,
 * até a pessoa baixar ou clicar já salvei").
 *
 * Whether the office saved the files lives in the audit, nowhere else: the
 * "Já salvei" click and the full download each write
 * `<kind>.files-saved`, and undoing the click writes
 * `<kind>.files-saved-undone`. The latest of the two says where it stands,
 * and both stay in the protocol's history.
 */

export const FILES_SAVED_ACTION = "files-saved";
export const FILES_SAVED_UNDONE_ACTION = "files-saved-undone";

/** The kinds whose protocols carry files (an appointment carries none). */
const FILE_KINDS = ["service-request", "data-rights", "ombudsman"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export function isFileKind(kind: string): kind is FileKind {
  return (FILE_KINDS as readonly string[]).includes(kind);
}

export interface RequestFilesDue {
  requestId: string;
  kind: FileKind;
  protocolNumber: string;
  applicantName: string | null;
  /** The last day the first of its files is kept. */
  until: IsoDate;
  daysLeft: number;
  /** Files still stored. */
  fileCount: number;
}

export interface FilesSavedMark {
  saved: boolean;
  at: Date;
  how: string | null;
}

/** Where "Já salvei" stands for each protocol, read from the audit. */
export async function filesSavedMarksWith(
  database: Database,
  tenantSlug: string,
  requestIds: readonly string[],
): Promise<Map<string, FilesSavedMark>> {
  const marks = new Map<string, FilesSavedMark>();
  if (requestIds.length === 0) return marks;
  const actions = FILE_KINDS.flatMap((k) => [
    `${k}.${FILES_SAVED_ACTION}`,
    `${k}.${FILES_SAVED_UNDONE_ACTION}`,
  ]);
  const rows = await database
    .select({
      targetId: auditLog.targetId,
      action: auditLog.action,
      reason: auditLog.reason,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantSlug, tenantSlug),
        inArray(auditLog.action, actions),
        inArray(auditLog.targetId, [...requestIds]),
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id));
  for (const row of rows) {
    if (!row.targetId || marks.has(row.targetId)) continue;
    marks.set(row.targetId, {
      saved: row.action.endsWith(`.${FILES_SAVED_ACTION}`),
      at: row.createdAt,
      how: row.reason,
    });
  }
  return marks;
}

/**
 * The closed protocols whose files go in the next 10 days and that nobody
 * downloaded or marked as saved: the reminder the panel shows every day
 * until one of the two happens. Soonest first.
 */
export async function listRequestFilesDueWith(
  database: Database,
  tenantSlug: string,
  today: IsoDate,
  kinds: readonly string[],
): Promise<RequestFilesDue[]> {
  const wanted = kinds.filter(isFileKind);
  if (wanted.length === 0) return [];
  // A wide net in SQL, the rule decides: a file is due soon only if its
  // protocol closed at least (90 - 10) days ago; one day of margin keeps the
  // office's time zone out of the comparison.
  const cutoff = new Date(
    Date.parse(`${today}T00:00:00Z`) -
      (REQUEST_FILE_RETENTION_DAYS - REQUEST_FILE_WARNING_DAYS - 1) *
        86_400_000,
  );
  const rows = await database
    .select({
      requestId: serviceRequests.id,
      kind: serviceRequests.kind,
      protocolNumber: serviceRequests.protocolNumber,
      applicantName: serviceRequests.applicantName,
      closedAt: serviceRequests.closedAt,
      path: serviceRequestAttachments.path,
      purgedAt: serviceRequestAttachments.purgedAt,
      createdAt: serviceRequestAttachments.createdAt,
    })
    .from(serviceRequestAttachments)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, serviceRequestAttachments.requestId),
    )
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        isNotNull(serviceRequestAttachments.path),
        isNull(serviceRequestAttachments.purgedAt),
        isNotNull(serviceRequests.closedAt),
        lt(serviceRequests.closedAt, cutoff),
        inArray(serviceRequests.kind, wanted),
      ),
    );

  const byRequest = new Map<string, RequestFilesDue>();
  for (const row of rows) {
    const status = requestFileStatusOf(row, row, today);
    if (!requestFileServable(status) || status.kind !== "available") continue;
    const current = byRequest.get(row.requestId);
    if (current) {
      current.fileCount += 1;
      if (status.until < current.until) {
        current.until = status.until;
        current.daysLeft = status.daysLeft;
      }
      continue;
    }
    byRequest.set(row.requestId, {
      requestId: row.requestId,
      kind: row.kind as FileKind,
      protocolNumber: row.protocolNumber,
      applicantName: row.applicantName,
      until: status.until,
      daysLeft: status.daysLeft,
      fileCount: 1,
    });
  }
  const due = [...byRequest.values()].filter((r) =>
    requestFileDueSoon({
      kind: "available",
      until: r.until,
      daysLeft: r.daysLeft,
    }),
  );
  const marks = await filesSavedMarksWith(
    database,
    tenantSlug,
    due.map((r) => r.requestId),
  );
  return due
    .filter((r) => !marks.get(r.requestId)?.saved)
    .sort(
      (a, b) =>
        a.daysLeft - b.daysLeft ||
        a.protocolNumber.localeCompare(b.protocolNumber),
    );
}

export async function listRequestFilesDue(
  tenantSlug: string,
  today: IsoDate,
  kinds: readonly string[],
): Promise<RequestFilesDue[]> {
  return listRequestFilesDueWith(db, tenantSlug, today, kinds);
}

async function kindOf(
  database: Database,
  tenantSlug: string,
  requestId: string,
): Promise<FileKind | undefined> {
  const [row] = await database
    .select({ kind: serviceRequests.kind })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    )
    .limit(1);
  return row && isFileKind(row.kind) ? row.kind : undefined;
}

/**
 * "Já salvei", or the full download: the reminder stops for this protocol.
 * `how` says which, in the audit's own words.
 */
export async function markRequestFilesSavedWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  actorId: string,
  how: "button" | "download",
): Promise<boolean> {
  const kind = await kindOf(database, tenantSlug, requestId);
  if (!kind) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: `${kind}.${FILES_SAVED_ACTION}`,
    targetType: kind,
    targetId: requestId,
    reason:
      how === "download"
        ? "baixou todos os arquivos do protocolo (ZIP)"
        : "marcou que já salvou os arquivos no acervo da serventia",
  });
  return true;
}

/** Undoes "Já salvei": the reminder comes back; both marks stay in the
 * audit. */
export async function undoRequestFilesSavedWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  actorId: string,
): Promise<boolean> {
  const kind = await kindOf(database, tenantSlug, requestId);
  if (!kind) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: `${kind}.${FILES_SAVED_UNDONE_ACTION}`,
    targetType: kind,
    targetId: requestId,
  });
  return true;
}

/**
 * Every file of a protocol still stored, in one ZIP, named by the protocol.
 * Undefined when there is nothing left to download.
 */
export async function zipRequestFilesWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  today: IsoDate,
): Promise<{ bytes: Uint8Array; protocolNumber: string } | undefined> {
  const rows = await database
    .select({
      path: serviceRequestAttachments.path,
      purgedAt: serviceRequestAttachments.purgedAt,
      createdAt: serviceRequestAttachments.createdAt,
      displayName: serviceRequestAttachments.displayName,
      storedName: serviceRequestAttachments.storedName,
      closedAt: serviceRequests.closedAt,
      protocolNumber: serviceRequests.protocolNumber,
    })
    .from(serviceRequestAttachments)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, serviceRequestAttachments.requestId),
    )
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
        isNotNull(serviceRequestAttachments.path),
      ),
    )
    .orderBy(serviceRequestAttachments.createdAt);
  const servable = rows.filter((r) =>
    requestFileServable(requestFileStatusOf(r, r, today)),
  );
  if (servable.length === 0) return undefined;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const row of servable) {
    const path = row.path as string;
    const bytes = path.startsWith("http")
      ? new Uint8Array(await (await fetch(path)).arrayBuffer())
      : new Uint8Array(await readFile(path));
    const base = (row.displayName || "arquivo").replace(/[\\/:*?"<>|]/g, "-");
    const ext = extname(row.storedName);
    let name = `${base}${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = `${base} (${n})${ext}`;
    }
    used.add(name.toLowerCase());
    zip.file(name, bytes);
  }
  return {
    bytes: await zip.generateAsync({ type: "uint8array" }),
    protocolNumber: servable[0]?.protocolNumber ?? "",
  };
}

export const ROUTE_BY_FILE_KIND: Record<FileKind, string> = {
  "service-request": "/admin/pedidos",
  "data-rights": "/admin/lgpd",
  ombudsman: "/admin/ouvidoria",
};

/** Kinds as the reminder names them. */
export const FILE_KIND_LABELS: Record<FileKind, string> = {
  "service-request": "Pedido",
  "data-rights": "LGPD",
  ombudsman: "Ouvidoria",
};
