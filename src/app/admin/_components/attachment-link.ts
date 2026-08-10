/**
 * No "use client" here on purpose: the detail page is a server component and
 * builds these hrefs while rendering, and a function exported from a client
 * module is a client reference the server cannot call.
 */

export interface AttachmentItem {
  id: string;
  displayName: string;
  createdAtLabel: string;
}

/** Where the panel serves any attachment, whatever section it belongs to. */
export function documentHref(requestId: string, attachmentId: string): string {
  return `/admin/documento?requestId=${requestId}&attachmentId=${attachmentId}`;
}

/**
 * Stored names are deliberately not the ones the browser sent: that string is
 * attacker controlled and routinely carries the citizen's full name (see
 * `src/core/request/attachment.ts`). What it stores instead is a slug, and a
 * slug is not something to show a registrar — least of all "office".
 */
const LABELS: Record<string, string> = {
  "documento-final": "Documento final",
  "requerimento-assinado": "Requerimento assinado",
  office: "Relatório de dados",
  "formulario-exigencia": "Formulário da exigência",
};

export function attachmentLabel(displayName: string): string {
  return LABELS[displayName] ?? displayName;
}
