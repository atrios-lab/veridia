import type { RequestFileStatus } from "@/core/request/attachment-retention.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";

/**
 * No "use client" here on purpose: the detail page is a server component and
 * builds these hrefs while rendering, and a function exported from a client
 * module is a client reference the server cannot call.
 */

export interface AttachmentItem {
  id: string;
  displayName: string;
  createdAtLabel: string;
  /** Shown so a blank 14 KB scan or a 40 MB PDF is caught before opening. */
  sizeBytes?: number;
  /**
   * Set once the 30-day rule deleted the file (or it is past its 30 days and
   * the routes refuse it): the row stays as the record, with nothing to open.
   */
  goneLabel?: string;
}

/** Where the panel serves any attachment, whatever section it belongs to. */
export function documentHref(requestId: string, attachmentId: string): string {
  return `/admin/documento?requestId=${requestId}&attachmentId=${attachmentId}`;
}

/**
 * Stored names are deliberately not the ones the browser sent: that string is
 * attacker controlled and routinely carries the citizen's full name (see
 * `src/core/request/attachment.ts`). What it stores instead is a slug, and a
 * slug is not something to show a registrar, least of all "office".
 */
const LABELS: Record<string, string> = {
  "documento-final": "Documento final",
  "requerimento-assinado": "Requerimento assinado",
  "declaracao-assinada": "Declaração assinada",
  office: "Relatório de dados",
  "formulario-exigencia": "Formulário da exigência",
};

export function attachmentLabel(displayName: string): string {
  // The citizen's files named nothing: "anexo-2" reads "Anexo 2".
  const numbered = /^anexo-(\d+)$/.exec(displayName);
  if (numbered) return `Anexo ${numbered[1]}`;
  return LABELS[displayName] ?? displayName;
}

/**
 * What a row says in place of "Ver" once a file is out under the 30-day rule:
 * deleted (with the day), or past its 30 days and only waiting for the next
 * purge, which the routes already refuse to serve.
 */
export function requestFileGoneLabel(
  purgedAt: Date | null,
  status: RequestFileStatus,
): string | undefined {
  if (purgedAt) return `apagado em ${formatOfficeDate(purgedAt)}`;
  if (status.kind === "expired") return "apagado pela regra de 30 dias";
  return undefined;
}
