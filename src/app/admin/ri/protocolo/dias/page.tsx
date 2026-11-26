import Link from "next/link";
import { shortDate } from "@/core/ri/books.ts";
import { closingReason, weekdayName } from "@/core/ri/protocol-days.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { closedDaysWith, pendingDaysWith } from "@/lib/ri-protocol-days.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { SignOrPrint } from "../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { ActionButton, ConfirmButton } from "../../_components/client.tsx";
import { Panel, RiPage } from "../../_components/page.tsx";
import { CloseDaysForm } from "../../_components/protocol-days-form.tsx";
import { requireRi, riCan } from "../../_lib.ts";
import {
  closeProtocolDaysAction,
  reopenProtocolDayAction,
} from "../../actions.ts";

export const metadata = { title: "Encerramento dos dias do Protocolo" };

const KIND_LABELS: Record<string, string> = {
  movimento: "com títulos",
  "sem-movimento": "sem movimento",
  feriado: "feriado",
  "fim-de-semana": "fim de semana",
};

/**
 * The daily closing of the Protocolo (Lei nº 6.015/1973, art. 184): the
 * days still open, closed one by one or all at once, each termo on its
 * own date; the closed days with their book page to see, print or sign.
 */
export default async function ProtocolDaysPage() {
  const { session, tenant } = await requireRi();
  const today = officeToday();
  const [pending, closed, books] = await Promise.all([
    pendingDaysWith(db, tenant.slug, today),
    closedDaysWith(db, tenant.slug),
    listBooksWith(db, tenant.slug),
  ]);
  const canClose = riCan(session, "ri.books");
  const holidays = officeHolidays(tenant);
  const book1 = books.find((b) => b.book === 1 && !b.deletedAt && !b.closedOn);
  const recent = [...closed.values()]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 60);
  return (
    <RiPage
      title="Encerramento dos dias do Protocolo"
      description="O Protocolo é encerrado diariamente (Lei nº 6.015/1973, art. 184). Enquanto o dia está aberto, dá para prenotar com a data dele; ao encerrar, cada termo sai com a data do próprio dia, mesmo encerrando a semana na sexta."
      back={{ href: "/admin/ri/protocolo", label: "Protocolo (Livro 1)" }}
      actions={
        book1 ? (
          <Link
            href={`/admin/ri/livros/${book1.id}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Ver o Livro 1 e os termos
          </Link>
        ) : (
          <Link
            href="/admin/ri/livros"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Abrir o Livro 1 (termo de abertura)
          </Link>
        )
      }
    >
      <Panel
        title={
          pending.length
            ? `Dias abertos (${pending.length})`
            : "Nenhum dia aberto"
        }
        description="Dia sem título sai como encerrado sem movimento; feriado e fim de semana dizem o motivo."
      >
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos os dias estão encerrados.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {canClose && (
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  action={closeProtocolDaysAction}
                  fields={{ de: pending[0] ?? today, ate: today }}
                  label={`Encerrar todos os ${pending.length} dias, até hoje`}
                  pendingLabel="Encerrando…"
                  variant="default"
                />
                {pending.some((d) => d < today) && (
                  <ActionButton
                    action={closeProtocolDaysAction}
                    fields={{
                      de: pending[0] ?? today,
                      ate: pending.filter((d) => d < today).at(-1) ?? today,
                    }}
                    label="Encerrar até ontem (deixar hoje aberto)"
                    pendingLabel="Encerrando…"
                  />
                )}
              </div>
            )}
            <ul className="flex flex-col divide-y">
              {pending.slice(0, 120).map((day) => {
                const reason = closingReason(day, 0, holidays);
                return (
                  <li
                    key={day}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <span>
                      {shortDate(day)} · {weekdayName(day)}
                      {reason.why && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {reason.why}
                        </span>
                      )}
                      {day === today && (
                        <span className="text-muted-foreground"> · hoje</span>
                      )}
                    </span>
                    {canClose && (
                      <ActionButton
                        action={closeProtocolDaysAction}
                        fields={{ de: day, ate: day }}
                        label="Encerrar este dia"
                        pendingLabel="Encerrando…"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Panel>

      {canClose && (
        <Panel
          title="Encerrar um período"
          description="Dias, semanas ou meses sem movimento de uma vez: cada dia sai com a sua data e o motivo."
        >
          <CloseDaysForm today={today} />
        </Panel>
      )}

      <Panel title="Dias encerrados (os mais recentes)">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dia encerrado ainda.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {recent.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm">
                  {shortDate(row.day)} · {weekdayName(row.day)} ·{" "}
                  <span className="text-muted-foreground">
                    {KIND_LABELS[row.kind] ?? row.kind}
                    {row.count
                      ? ` (${row.count} ${row.count === 1 ? "título" : "títulos"})`
                      : row.why
                        ? ` (${row.why})`
                        : ""}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <SignOrPrint
                    pdfHref={`/admin/ri/livros/protocolo-do-dia?data=${row.day}`}
                    title={`Protocolo do dia ${shortDate(row.day)}`}
                    size="sm"
                  />
                  {canClose && (
                    <ConfirmButton
                      action={reopenProtocolDayAction}
                      fields={{ dia: row.day }}
                      trigger="Reabrir"
                      question={`Reabrir o Protocolo de ${shortDate(row.day)}?`}
                      consequence="O dia volta a aceitar prenotação com a data dele. O encerramento anterior fica guardado com a justificativa e na auditoria; encerre o dia de novo depois."
                      confirmLabel="Reabrir"
                      pendingLabel="Reabrindo…"
                      destructive={false}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </RiPage>
  );
}
