import "server-only";
import { and, eq, sql } from "drizzle-orm";
import {
  judgeSignedForm,
  type SignedFormCheck,
  type SignedFormVerdict,
} from "@/core/request/signed-form-check.ts";
import type { Database } from "@/db/index.ts";
import { serviceRequests } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { pdfTableText } from "./fee-tables.ts";
import { hasSignature } from "./signature/pades.ts";
import { readStoredFile, type StoredAttachment } from "./uploads.ts";

/**
 * Reads the requerimento the citizen sent (decision of 12/11/2026): its
 * text, to tell whether it is the requerimento of this protocol, and its
 * digital signature field. A file that cannot be read is sent to the
 * office's check, never accepted by default.
 */
export async function readSignedForm(
  stored: Pick<StoredAttachment, "path" | "mimeType">,
  protocolNumber: string,
): Promise<{ verdict: SignedFormVerdict; reason: string }> {
  const isPdf = stored.mimeType === "application/pdf";
  let bytes: Buffer;
  try {
    bytes = await readStoredFile(stored.path);
  } catch (error) {
    console.error("signed-form.read", error);
    return {
      verdict: "review",
      reason: "Não foi possível ler o arquivo: conferência pela serventia.",
    };
  }
  let text = "";
  if (isPdf) {
    try {
      text = await pdfTableText(new Uint8Array(bytes));
    } catch {
      // A PDF the reader cannot open reads as one without text: the
      // office looks at it.
    }
  }
  return judgeSignedForm({
    mimeType: stored.mimeType,
    text,
    digitallySigned: isPdf && hasSignature(bytes),
    protocolNumber,
  });
}

/** Kept with the request: what the reading said, or the office's check. */
export async function saveSignedFormCheckWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  check: SignedFormCheck,
  actorId: string | null,
): Promise<void> {
  await database
    .update(serviceRequests)
    .set({
      details: sql`${serviceRequests.details} || ${JSON.stringify({ signedFormCheck: check })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceRequests.tenantSlug, tenantSlug),
        eq(serviceRequests.id, requestId),
      ),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action:
      check.verdict === "returned"
        ? "service-request.signed-form-returned"
        : "service-request.signed-form-check",
    targetType: "service-request",
    targetId: requestId,
    ...(check.returnedReason ? { reason: check.returnedReason } : {}),
  });
}
