import Link from "next/link";
import { notFound } from "next/navigation";
import { getAct } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import {
  isServiceRequestStatus,
  SERVICE_REQUEST_STATUSES,
  statusLabel,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { ATTRIBUTIONS, type Attribution } from "@/core/tenant/schema.ts";
import { listServiceRequests } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { StatusBadge } from "./_components/status-badge.tsx";

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
  const { andamento, atribuicao, q } = await searchParams;

  const status =
    andamento && isServiceRequestStatus(andamento) ? andamento : undefined;
  const attribution =
    atribuicao && (ATTRIBUTIONS as readonly string[]).includes(atribuicao)
      ? (atribuicao as Attribution)
      : undefined;
  const search = q?.trim() || undefined;

  const requests = await listServiceRequests(tenant.slug, {
    status,
    attribution,
    search,
  });

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
            <button
              type="submit"
              className="rounded-[9px] border border-admin-input-border bg-admin-card px-4 py-2.5 text-[13px] font-semibold text-admin-primary"
            >
              Filtrar
            </button>
          </form>
          <Link
            href="/admin/pedidos/novo"
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white"
          >
            + Lançar pedido
          </Link>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="grid grid-cols-[150px_1.6fr_1.4fr_170px_110px_100px_20px] gap-2 border-b border-admin-border px-5 py-2.5 text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase">
            <span>Protocolo</span>
            <span>Solicitante</span>
            <span>Ato</span>
            <span>Andamento</span>
            <span>Valor</span>
            <span>Data</span>
            <span />
          </div>

          {requests.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
              Nenhum pedido encontrado com esses filtros.
            </p>
          ) : (
            requests.map((request) => {
              const act = request.actId ? getAct(request.actId) : undefined;
              const requestStatus = isServiceRequestStatus(request.status)
                ? request.status
                : "new";
              return (
                <Link
                  key={request.id}
                  href={`/admin/pedidos/${encodeURIComponent(request.protocolNumber)}`}
                  className="grid grid-cols-[150px_1.6fr_1.4fr_170px_110px_100px_20px] items-center gap-2 border-b border-admin-border px-5 py-3 text-[13px] last:border-b-0 hover:bg-admin-input-bg"
                >
                  <span className="font-bold tabular-nums text-admin-primary">
                    {request.protocolNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-admin-text">
                      {request.applicantName ?? "—"}
                    </span>
                    <span className="block truncate text-[11.5px] text-admin-faint">
                      {request.contact ?? ""}
                    </span>
                  </span>
                  <span className="truncate text-admin-muted">
                    {act?.name ?? "—"}
                  </span>
                  <StatusBadge
                    status={requestStatus}
                    label={statusLabel("service-request", requestStatus)}
                  />
                  <span className="tabular-nums text-admin-text">
                    {request.amountCents != null
                      ? formatCents(request.amountCents)
                      : "—"}
                  </span>
                  <span className="text-admin-faint">
                    {shortDate(request.createdAt)}
                  </span>
                  <span aria-hidden="true" className="text-admin-faint">
                    ›
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </>
  );
}
