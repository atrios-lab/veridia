import Link from "next/link";
import { notFound } from "next/navigation";
import { getAct } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { deadlineUrgency } from "@/core/overview/urgency.ts";
import { effectiveDeadline, readDeadline } from "@/core/request/deadline.ts";
import {
  isOpenServiceRequestStatus,
  isServiceRequestStatus,
  SERVICE_REQUEST_STATUSES,
  statusLabel,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { ATTRIBUTIONS, type Attribution } from "@/core/tenant/schema.ts";
import { listServiceRequests } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { compareQueueRows, queueGroupOf } from "./_components/queue-order.ts";
import { QueueRows } from "./_components/queue-rows.tsx";

export const metadata = { title: "Pedidos de serviço" };

const ATTRIBUTION_SHORT: Record<Attribution, string> = {
  RCPN: "RCPN",
  NOTAS: "Notas",
  RI: "RI",
  PROTESTO: "Protesto",
  RTD: "RTD",
  RCPJ: "RCPJ",
};

function shortDate(date: Date): string {
  return formatDate(toIsoDate(date, OFFICE_TIME_ZONE)).slice(0, 5);
}

export default async function ServiceRequestQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    andamento?: string;
    atribuicao?: string;
    q?: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) notFound();
  const tenant = await getTenant();
  // Read once for the whole queue: every row's term is measured against the
  // same day, and a clock read per row could straddle midnight.
  const todayIso = today();
  const { andamento, atribuicao, q } = await searchParams;

  const status =
    andamento && isServiceRequestStatus(andamento) ? andamento : undefined;
  const attribution =
    atribuicao && (ATTRIBUTIONS as readonly string[]).includes(atribuicao)
      ? (atribuicao as Attribution)
      : undefined;
  const search = q?.trim() || undefined;
  const hasFilters = Boolean(status || attribution || search);

  const requests = await listServiceRequests(tenant.slug, {
    status,
    attribution,
    search,
  });

  // Bands before dates: the office reads the queue for what needs a hand,
  // not for what arrived last. See queue-order.ts for the order inside a band.
  const rows = requests
    .map((request) => {
      const act = request.actId ? getAct(request.actId) : undefined;
      const status = isServiceRequestStatus(request.status)
        ? request.status
        : "new";
      const open = isOpenServiceRequestStatus(status);
      const deadline = effectiveDeadline(
        toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
        readDeadline(request.details),
        act?.legalDeadlineDays,
        tenant.requestDeadlineDays,
      );
      const urgency = deadlineUrgency(open, deadline, todayIso);
      return {
        id: request.id,
        protocolNumber: request.protocolNumber,
        applicantName: request.applicantName ?? "Não informado",
        contact: request.contact ?? "",
        actName: act?.name ?? "Ato não identificado",
        status,
        statusLabel: statusLabel("service-request", status),
        amountText:
          request.amountCents != null
            ? formatCents(request.amountCents)
            : "A definir",
        dateText: shortDate(request.createdAt),
        open,
        deadline,
        urgency,
        group: queueGroupOf(status),
        createdAt: request.createdAt,
      };
    })
    .sort(compareQueueRows);
  // One band alone (a filter by andamento, say) needs no heading over it.
  const showBands = new Set(rows.map((r) => r.group)).size > 1;

  return (
    <>
      <AdminPageHeader title="Pedidos de serviço" />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex flex-1 flex-wrap gap-2.5" method="get">
            <div className="relative">
              <select
                name="andamento"
                defaultValue={status ?? ""}
                className="appearance-none rounded-[9px] border border-admin-input-border bg-admin-card py-2.5 pr-9 pl-3.5 text-[13px] font-semibold text-admin-primary"
              >
                <option value="">Andamento: Todos</option>
                {SERVICE_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel("service-request", s)}
                  </option>
                ))}
              </select>
              <AdminIcon
                name="chevronDown"
                className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
                strokeWidth={2}
              />
            </div>
            <div className="relative">
              <select
                name="atribuicao"
                defaultValue={attribution ?? ""}
                className="appearance-none rounded-[9px] border border-admin-input-border bg-admin-card py-2.5 pr-9 pl-3.5 text-[13px] font-semibold text-admin-primary"
              >
                <option value="">Atribuição: Todas</option>
                {tenant.attributions.map((a) => (
                  <option key={a} value={a}>
                    {ATTRIBUTION_SHORT[a]}
                  </option>
                ))}
              </select>
              <AdminIcon
                name="chevronDown"
                className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted"
                strokeWidth={2}
              />
            </div>
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="Buscar por protocolo ou nome"
              className="min-w-[220px] flex-1 rounded-[9px] border border-admin-input-border bg-admin-card px-3.5 py-2.5 text-[13px] text-admin-text placeholder:text-admin-faint"
            />
            <button type="submit" className="btn btn-admin-secondary btn-md">
              Filtrar
            </button>
          </form>
          <Link
            href="/admin/pedidos/novo"
            className="btn btn-admin-primary btn-md"
          >
            + Lançar pedido
          </Link>
        </div>

        <QueueRows
          rows={rows}
          showBands={showBands}
          today={todayIso}
          emptyMessage={
            hasFilters
              ? "Nenhum pedido encontrado com esses filtros."
              : "Nenhum pedido registrado ainda."
          }
        />
      </main>
    </>
  );
}
