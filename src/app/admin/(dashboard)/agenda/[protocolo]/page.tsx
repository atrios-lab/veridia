import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { parseDetails, statusLabel } from "@/core/request/kinds.ts";
import {
  formatShortDate,
  nextBusinessDays,
  shortWeekday,
} from "@/core/scheduling/calendar.ts";
import { OFFERED_DAYS, slots } from "@/core/scheduling/slots.ts";
import {
  appointmentOccupancy,
  findByProtocol,
  listRecordHistory,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { AppointmentStatusBadge } from "../_components/status-badge.tsx";
import { ActionsSection } from "./_components/actions-section.tsx";
import type { DayOption } from "./_components/propose-slot-picker.tsx";

export const metadata = { title: "Pedido de horário" };

const HISTORY_LABELS: Record<string, string> = {
  "appointment.create": "registrou o pedido de horário",
  "appointment.confirm": "confirmou o horário",
  "appointment.propose": "propôs outro horário",
  "appointment.cancel": "cancelou o pedido",
  "appointment.attend": "marcou como atendido",
};

function band(hour: number): string {
  return `${hour}h – ${hour + 1}h`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <p className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text">
        {value}
      </p>
    </div>
  );
}

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ protocolo: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();

  const tenant = await getTenant();
  const { protocolo } = await params;
  const record = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!record || record.kind !== "appointment") notFound();

  const details = parseDetails("appointment", record.details);

  const days = nextBusinessDays(today(), OFFERED_DAYS);
  const occupancy = await appointmentOccupancy(
    tenant.slug,
    days[0],
    days[days.length - 1],
  );
  const dayOptions: DayOption[] = days.map((date) => ({
    date,
    shortLabel: `${shortWeekday(date)} ${date.slice(8, 10)}`,
    bands: slots(tenant.scheduling, occupancy.get(date) ?? {}),
  }));

  const history = await listRecordHistory(
    tenant.slug,
    "appointment",
    record.id,
    record.protocolNumber,
  );

  return (
    <>
      <AdminPageHeader title={record.protocolNumber} />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/agenda"
            className="flex items-center gap-1.5 text-[12.5px] text-admin-muted hover:text-admin-primary"
          >
            ‹ Agenda de atendimentos
          </Link>
          <span className="h-[18px] w-px bg-admin-border" />
          <AppointmentStatusBadge
            status={record.status}
            label={statusLabel("appointment", record.status)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-4.5">
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <Field
                  label="Solicitante"
                  value={record.applicantName ?? "—"}
                />
                <Field label="Contato" value={record.contact ?? "—"} />
              </div>
              {details.subject && (
                <div className="mt-3.5">
                  <Field
                    label="Sobre o que é o atendimento"
                    value={details.subject}
                  />
                </div>
              )}

              <div className="mt-5 border-t border-admin-border pt-4.5">
                <span className="text-[13px] font-bold text-admin-primary">
                  Faixa pedida: {formatShortDate(details.date)} ·{" "}
                  {band(details.slotHour)}
                </span>
                {details.proposedDate &&
                  details.proposedSlotHour !== undefined && (
                    <p className="mt-1.5 text-[12.5px] text-admin-muted">
                      Faixa proposta: {formatShortDate(details.proposedDate)} ·{" "}
                      {band(details.proposedSlotHour)}
                      {details.acceptedAt && " · aceita pelo cidadão"}
                    </p>
                  )}
              </div>

              <ActionsSection
                requestId={record.id}
                status={record.status}
                days={dayOptions}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4.5">
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
              <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
                Histórico
              </h4>
              {history.length === 0 ? (
                <p className="mt-2 text-[12px] text-admin-muted">
                  Sem eventos registrados.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {history.map((entry, index) => (
                    <li
                      key={`${entry.action}-${entry.createdAt.toISOString()}-${index}`}
                      className="text-[12.5px] leading-snug text-admin-text"
                    >
                      <strong className="text-admin-primary">
                        {entry.actorName ?? "Sistema"}
                      </strong>{" "}
                      {HISTORY_LABELS[entry.action] ?? entry.action}
                      <br />
                      <span className="text-[11px] text-admin-faint">
                        {formatDayMonthTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
