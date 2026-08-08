import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { parseDetails, statusLabel } from "@/core/request/kinds.ts";
import { formatShortDate } from "@/core/scheduling/calendar.ts";
import { listRecordsByKind } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { AppointmentStatusBadge } from "./_components/status-badge.tsx";

export const metadata = { title: "Agenda de atendimentos" };

function band(hour: number): string {
  return `${hour}h–${hour + 1}h`;
}

export default async function AppointmentQueuePage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const appointments = await listRecordsByKind(tenant.slug, "appointment");

  return (
    <>
      <AdminPageHeader title="Agenda de atendimentos" />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="grid grid-cols-[150px_1.6fr_1.4fr_140px_20px] gap-2 border-b border-admin-border px-5 py-2.5 text-[11px] font-bold tracking-[0.06em] text-admin-faint uppercase">
            <span>Protocolo</span>
            <span>Solicitante</span>
            <span>Faixa pedida</span>
            <span>Status</span>
            <span />
          </div>

          {appointments.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
              Nenhum pedido de horário registrado.
            </p>
          ) : (
            appointments.map((record) => {
              const details = parseDetails("appointment", record.details);
              return (
                <Link
                  key={record.id}
                  href={`/admin/agenda/${encodeURIComponent(record.protocolNumber)}`}
                  className="grid grid-cols-[150px_1.6fr_1.4fr_140px_20px] items-center gap-2 border-b border-admin-border px-5 py-3 text-[13px] last:border-b-0 hover:bg-admin-input-bg"
                >
                  <span className="font-bold tabular-nums text-admin-primary">
                    {record.protocolNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-admin-text">
                      {record.applicantName ?? "—"}
                    </span>
                    <span className="block truncate text-[11.5px] text-admin-faint">
                      {record.contact ?? ""}
                    </span>
                  </span>
                  <span className="truncate text-admin-muted">
                    {formatShortDate(details.date)} · {band(details.slotHour)}
                  </span>
                  <AppointmentStatusBadge
                    status={record.status}
                    label={statusLabel("appointment", record.status)}
                  />
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
