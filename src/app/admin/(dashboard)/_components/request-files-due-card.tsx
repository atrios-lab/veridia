import Link from "next/link";
import {
  REQUEST_FILE_RETENTION_DAYS,
  REQUEST_FILE_WARNING_DAYS,
} from "@/core/request/attachment-retention.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import {
  FILE_KIND_LABELS,
  listRequestFilesDue,
  ROUTE_BY_FILE_KIND,
} from "@/lib/request-files-due.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import { markFilesSavedAction } from "../documento/actions.ts";

/** How many protocols the card lists before "e mais N". */
const SHOWN = 6;

/**
 * The daily reminder on the Visão geral (decision of 22/11/2026): the closed
 * protocols whose files are deleted in the next 10 days, until someone
 * downloads them ("Baixar tudo", which also stops the reminder) or clicks
 * "Já salvei". It shows every day of those 10 days because it is computed
 * when the panel opens, not sent once.
 *
 * A card that cannot load renders nothing: the Visão geral must open even if
 * this query fails (same posture as ComplianceCard).
 */
export async function RequestFilesDueCard({
  tenantSlug,
  today,
  kinds,
}: {
  tenantSlug: string;
  today: string;
  kinds: readonly string[];
}) {
  let due: Awaited<ReturnType<typeof listRequestFilesDue>>;
  try {
    due = await listRequestFilesDue(tenantSlug, today, kinds);
  } catch (error) {
    console.error("request-files-due.load", error);
    return null;
  }
  if (due.length === 0) return null;
  const shown = due.slice(0, SHOWN);

  return (
    <section
      aria-labelledby="arquivos-vencendo"
      className="rounded-xl border border-warning/40 bg-warning-soft p-5 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <AdminIcon
          name="alert"
          className="mt-0.5 h-5 w-5 shrink-0 text-warning-text"
        />
        <div className="min-w-0">
          <h2
            id="arquivos-vencendo"
            className="text-base font-semibold text-foreground"
          >
            Arquivos que vão ser apagados
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-warning-text">
            {due.length === 1
              ? "1 protocolo encerrado tem arquivos"
              : `${due.length} protocolos encerrados têm arquivos`}{" "}
            que o painel apaga {REQUEST_FILE_RETENTION_DAYS} dias após o
            encerramento. Baixe e guarde no acervo da serventia. Este aviso
            aparece todo dia nos últimos {REQUEST_FILE_WARNING_DAYS} dias, até
            baixar tudo ou clicar em "Já salvei".
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {shown.map((item) => (
          <li
            key={item.requestId}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2.5"
          >
            <div className="mr-auto min-w-0">
              <Link
                href={`${ROUTE_BY_FILE_KIND[item.kind]}/${encodeURIComponent(item.protocolNumber)}`}
                className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
              >
                {item.protocolNumber}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {FILE_KIND_LABELS[item.kind]}
                {item.applicantName ? ` · ${item.applicantName}` : ""}
              </span>
              <p
                className={cn(
                  "text-xs",
                  item.daysLeft <= 3
                    ? "font-semibold text-destructive"
                    : "text-warning-text",
                )}
              >
                {item.fileCount === 1
                  ? "1 arquivo"
                  : `${item.fileCount} arquivos`}{" "}
                até {formatDate(item.until)} ({daysLeftLabel(item.daysLeft)})
              </p>
            </div>
            <a
              href={`/admin/documento/todos?pedido=${encodeURIComponent(item.requestId)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <AdminIcon name="download" className="h-4 w-4" /> Baixar tudo
            </a>
            <form action={markFilesSavedAction}>
              <input type="hidden" name="requestId" value={item.requestId} />
              <button
                type="submit"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <AdminIcon name="check" className="h-4 w-4" /> Já salvei
              </button>
            </form>
          </li>
        ))}
      </ul>
      {due.length > SHOWN && (
        <p className="mt-2 text-xs text-muted-foreground">
          e mais {due.length - SHOWN}{" "}
          {due.length - SHOWN === 1 ? "protocolo" : "protocolos"}.
        </p>
      )}
    </section>
  );
}

export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft === 0) return "último dia";
  return daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`;
}
