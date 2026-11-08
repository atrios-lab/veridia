import {
  REQUEST_FILE_RETENTION_DAYS,
  type RequestFileStatus,
  requestFileDueSoon,
} from "@/core/request/attachment-retention.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";

/**
 * Where a closed protocol's files stand under the 30-day rule, said once at
 * the top of the detail: until when they are kept (in warning tone in the
 * last 7 days), or that they were deleted. Nothing while the protocol is
 * open: nothing goes then, and a notice that says so on every open request
 * would only be noise.
 *
 * `files` is every attachment of the protocol, each with its status from
 * `requestFileStatusOf`.
 */
export function RequestFilesNotice({
  files,
}: {
  files: { status: RequestFileStatus; purgedAt: Date | null }[];
}) {
  const available = files
    .map((f) => f.status)
    .filter(
      (s): s is Extract<RequestFileStatus, { kind: "available" }> =>
        s.kind === "available",
    );
  // The earliest end among the files still stored: what the office has to
  // beat. A file sent after the closing ends later, never sooner.
  const next = available.reduce<(typeof available)[number] | undefined>(
    (earliest, s) => (!earliest || s.until < earliest.until ? s : earliest),
    undefined,
  );

  if (next) {
    const soon = requestFileDueSoon(next);
    return (
      <p
        className={
          soon
            ? "rounded-[10px] border border-admin-warning-soft-border bg-admin-warning-bg px-4 py-3 text-[12.5px] leading-relaxed text-admin-warning-text"
            : "rounded-[10px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4 py-3 text-[12.5px] leading-relaxed text-admin-warning-text"
        }
      >
        Protocolo encerrado. Os arquivos ficam até{" "}
        <strong>{formatDate(next.until)}</strong>
        {daysLeftLabel(next.daysLeft)} e depois são apagados,{" "}
        {REQUEST_FILE_RETENTION_DAYS} dias após o encerramento. Baixe e guarde
        no acervo da serventia o que precisar manter, como o requerimento
        assinado e o comprovante.
      </p>
    );
  }

  const purged = files
    .map((f) => f.purgedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (purged && files.every((f) => f.status.kind !== "held")) {
    return (
      <p className="rounded-[10px] border border-admin-border bg-admin-readonly-bg px-4 py-3 text-[12.5px] leading-relaxed text-admin-muted">
        Os arquivos deste protocolo foram apagados em {formatOfficeDate(purged)}
        , {REQUEST_FILE_RETENTION_DAYS} dias após o encerramento. O registro de
        cada um (nome, data e tamanho) continua.
      </p>
    );
  }
  // Past the 30 days, not yet deleted: the routes already refuse them, and
  // the next queue opening removes them from storage.
  if (files.some((f) => f.status.kind === "expired")) {
    return (
      <p className="rounded-[10px] border border-admin-border bg-admin-readonly-bg px-4 py-3 text-[12.5px] leading-relaxed text-admin-muted">
        Os arquivos deste protocolo passaram dos {REQUEST_FILE_RETENTION_DAYS}{" "}
        dias após o encerramento e não abrem mais. O registro de cada um (nome,
        data e tamanho) continua.
      </p>
    );
  }
  return null;
}

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return " (último dia)";
  return ` (${daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`})`;
}
