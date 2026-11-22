import {
  REQUEST_FILE_RETENTION_DAYS,
  type RequestFileStatus,
  requestFileDueSoon,
} from "@/core/request/attachment-retention.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { buttonVariants } from "../_ui/button.tsx";
import {
  markFilesSavedAction,
  undoFilesSavedAction,
} from "../(dashboard)/documento/actions.ts";
import { AdminIcon } from "./icon.tsx";

/**
 * Where a closed protocol's files stand under the 90-day rule, said once at
 * the top of the detail: until when they are kept (in warning tone in the
 * last 10 days), or that they were deleted. With `requestId`, it also offers
 * "Baixar tudo" (one ZIP) and "Já salvei", which stop the daily reminder of
 * the Visão geral; `saved` is where that mark stands, and it can be undone. Nothing while the protocol is
 * open: nothing goes then, and a notice that says so on every open request
 * would only be noise.
 *
 * `files` is every attachment of the protocol, each with its status from
 * `requestFileStatusOf`.
 */
export function RequestFilesNotice({
  files,
  requestId,
  saved,
}: {
  files: { status: RequestFileStatus; purgedAt: Date | null }[];
  requestId?: string;
  saved?: { saved: boolean; at: Date } | undefined;
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
    const soon = requestFileDueSoon(next) && !saved?.saved;
    return (
      <div
        className={
          soon
            ? "flex flex-col gap-3 rounded-lg bg-warning px-4 py-3 text-sm leading-relaxed text-warning-foreground"
            : "flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning-text"
        }
      >
        <p>
          Protocolo encerrado. Os arquivos ficam até{" "}
          <strong>{formatDate(next.until)}</strong>
          {daysLeftLabel(next.daysLeft)} e depois são apagados,{" "}
          {REQUEST_FILE_RETENTION_DAYS} dias após o encerramento. Baixe e guarde
          no acervo da serventia o que precisar manter, como o requerimento
          assinado e o comprovante.
          {saved?.saved &&
            ` Marcado como salvo em ${formatOfficeDate(saved.at)}: o aviso diário parou.`}
        </p>
        {requestId && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/admin/documento/todos?pedido=${encodeURIComponent(requestId)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <AdminIcon name="download" className="h-4 w-4" /> Baixar tudo
              (ZIP)
            </a>
            <form
              action={
                saved?.saved ? undoFilesSavedAction : markFilesSavedAction
              }
            >
              <input type="hidden" name="requestId" value={requestId} />
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {saved?.saved ? (
                  'Desfazer "Já salvei"'
                ) : (
                  <>
                    <AdminIcon name="check" className="h-4 w-4" /> Já salvei
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const purged = files
    .map((f) => f.purgedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (purged && files.every((f) => f.status.kind !== "held")) {
    return (
      <p className="rounded-lg border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Os arquivos deste protocolo foram apagados em {formatOfficeDate(purged)}
        , {REQUEST_FILE_RETENTION_DAYS} dias após o encerramento. O registro de
        cada um (nome, data e tamanho) continua.
      </p>
    );
  }
  // Past the 90 days, not yet deleted: the routes already refuse them, and
  // the next queue opening removes them from storage.
  if (files.some((f) => f.status.kind === "expired")) {
    return (
      <p className="rounded-lg border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
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
