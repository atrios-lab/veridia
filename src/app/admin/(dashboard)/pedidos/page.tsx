import Link from "next/link";
import { notFound } from "next/navigation";
import { ATTRIBUTION_ACRONYMS, getAct } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { deadlineUrgency } from "@/core/overview/urgency.ts";
import { effectiveDeadline, readDeadline } from "@/core/request/deadline.ts";
import {
  isOpenServiceRequestStatus,
  isServiceRequestStatus,
  statusLabel,
} from "@/core/request/kinds.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import {
  countByStatus,
  countServiceRequests,
  listServiceRequests,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import {
  CLOSED_TAB,
  clampPage,
  compareQueueRows,
  pageSlice,
  QUEUE_TABS,
  type QueueTabId,
  queueSearchParams,
  queueTab,
} from "./_components/queue-order.ts";
import { QueuePagination } from "./_components/queue-pagination.tsx";
import { type QueueRow, QueueRows } from "./_components/queue-rows.tsx";
import { QueueTabs } from "./_components/queue-tabs.tsx";
import { QueueToolbar } from "./_components/queue-toolbar.tsx";

export const metadata = { title: "Pedidos de serviço" };

function shortDate(date: Date): string {
  return formatDate(toIsoDate(date, OFFICE_TIME_ZONE)).slice(0, 5);
}

export default async function ServiceRequestQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    atribuicao?: string;
    q?: string;
    pagina?: string;
    por?: string;
  }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) notFound();
  const tenant = await getTenant();
  // Read once for the whole queue: every row's term is measured against the
  // same day, and a clock read per row could straddle midnight.
  const todayIso = today();
  const query = queueSearchParams(await searchParams, tenant.attributions);
  const tab = queueTab(query.tab);
  const closed = query.tab === CLOSED_TAB;
  const hasFilters = Boolean(query.attribution || query.search);

  const byStatus = await countByStatus(tenant.slug);
  const counts = Object.fromEntries(
    QUEUE_TABS.map((t) => [
      t.id,
      t.statuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0),
    ]),
  ) as Record<QueueTabId, number>;

  const filters = {
    statuses: tab.statuses,
    attribution: query.attribution,
    search: query.search,
  };

  function toRow(
    request: Awaited<ReturnType<typeof listServiceRequests>>[number],
  ) {
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
    const row: QueueRow = {
      id: request.id,
      protocolNumber: request.protocolNumber,
      applicantName: request.applicantName ?? "Não informado",
      actName: act?.name ?? "Ato não identificado",
      attributionLabel: request.attribution
        ? (ATTRIBUTION_ACRONYMS[request.attribution as Attribution] ??
          request.attribution)
        : "",
      status,
      statusLabel: statusLabel("service-request", status),
      open,
      deadline,
      dateText: shortDate(request.createdAt),
    };
    return {
      row,
      urgency: deadlineUrgency(open, deadline, todayIso),
      createdAt: request.createdAt,
    };
  }

  let total: number;
  let page: number;
  let rows: QueueRow[];
  if (closed) {
    // Finalizados reads newest first, which the database orders and pages
    // itself; this is the tab that grows without bound.
    total = await countServiceRequests(tenant.slug, filters);
    page = clampPage(query.page, total, query.size);
    const requests = await listServiceRequests(tenant.slug, {
      ...filters,
      limit: query.size,
      offset: (page - 1) * query.size,
    });
    rows = requests.map((request) => toRow(request).row);
  } else {
    // An open tab is read by term, which is computed from the request, the
    // act and the office's default rather than stored, so the whole tab
    // comes in and is sorted here. See queue-order.ts for the order.
    const requests = await listServiceRequests(tenant.slug, filters);
    const sorted = requests.map(toRow).sort(compareQueueRows);
    total = sorted.length;
    page = clampPage(query.page, total, query.size);
    rows = pageSlice(sorted, page, query.size).map((r) => r.row);
  }
  const current = { ...query, page };

  return (
    <>
      <AdminPageHeader
        title="Pedidos de serviço"
        description="Acompanhe e dê andamento aos pedidos feitos pelo site ou no balcão."
        actions={
          <Link
            href="/admin/pedidos/novo"
            className="inline-flex items-center gap-[9px] rounded-[11px] bg-admin-primary-soft px-[22px] py-[13px] text-[14px] font-bold whitespace-nowrap text-white transition-colors duration-120 hover:bg-admin-primary"
          >
            <AdminIcon name="plus" strokeWidth={2.4} className="h-4 w-4" />
            Lançar pedido
          </Link>
        }
      />
      <main className="flex flex-col gap-6 px-[30px] pt-6 pb-9">
        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <QueueTabs query={current} counts={counts} />
          <QueueToolbar query={current} attributions={tenant.attributions} />
          <QueueRows
            rows={rows}
            closed={closed}
            today={todayIso}
            hasFilters={hasFilters}
          />
          <QueuePagination query={current} total={total} />
        </div>
      </main>
    </>
  );
}
