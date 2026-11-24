import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { DemoHeldEmails } from "@/app/admin/_components/demo-held-emails.tsx";
import { FeeTableReminder } from "@/app/admin/_components/fee-table-reminder.tsx";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_NAMES,
  agendaIdOf,
  channelLabelsOn,
  slotEndTime,
  usesChannels,
} from "@/core/scheduling/agenda.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import {
  getCounterService,
  servicesOfAgenda,
} from "@/core/scheduling/services.ts";
import { db } from "@/db/index.ts";
import {
  findAppointmentById,
  getAgendaConfig,
  listAppointmentAttachments,
  listAppointmentNotes,
} from "@/lib/appointments.ts";
import { feeTableReferenceWith } from "@/lib/fee-tables.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { CorrectionForm, NoteForm, OfficeFilesForm } from "./detail-forms.tsx";

export const metadata = { title: "Detalhes do agendamento" };

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: OFFICE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * One appointment, opened from the day's list: what the citizen wrote and
 * sent, the office's internal notes and files, and the citizen's data to
 * correct when they typed something wrong.
 */
export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const { id } = await params;
  const appointment = await findAppointmentById(tenant.slug, id);
  if (!appointment) notFound();

  const agenda = agendaIdOf(appointment.agenda);
  // "Como fazer" for the services that carry one (the e-Notariado's), with
  // the reminder about the fee table when the act is charged by it.
  const guide = getCounterService(appointment.serviceId);
  const [config, files, notes, feeTable] = await Promise.all([
    getAgendaConfig(tenant.slug),
    listAppointmentAttachments(tenant.slug, [appointment.id]).catch(() => []),
    listAppointmentNotes(
      tenant.slug,
      appointment.id,
      session.user.role === "superadmin",
    ).catch(() => []),
    guide?.chargedByFeeTable
      ? feeTableReferenceWith(db, tenant.slug).catch(() => null)
      : Promise.resolve(null),
  ]);
  const citizenFiles = files.filter((file) => !file.uploadedBy);
  const officeFiles = files.filter((file) => file.uploadedBy);
  const services = servicesOfAgenda(config, agenda).map(
    ({ id: value, label }) => ({
      id: value,
      label,
    }),
  );
  if (!services.some((service) => service.id === appointment.serviceId)) {
    services.unshift({
      id: appointment.serviceId,
      label: appointment.serviceLabel,
    });
  }
  const modes = usesChannels(agenda)
    ? channelLabelsOn(config.agendas[agenda], appointment.date)
    : config.modes;
  const modeOptions = modes.includes(appointment.mode)
    ? modes
    : [appointment.mode, ...modes];
  const dayHref = `/admin/agenda?agenda=${agenda}&dia=${appointment.date}`;

  return (
    <>
      <AdminPageHeader maxWidth={960} title="Detalhes do agendamento" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <BackLink href={dayHref} label="Agenda do dia" />

        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {appointment.citizenName}
          </h2>
          <p className="mt-1 text-sm text-foreground">
            {formatFullDate(appointment.date)}, das {appointment.slotTime} às{" "}
            {slotEndTime(appointment.slotTime)} · {AGENDA_NAMES[agenda].name} ·{" "}
            {appointmentStatusLabel(appointment.status)}
            {appointment.protocolNumber && ` · ${appointment.protocolNumber}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {appointment.serviceLabel} · {appointment.mode} ·{" "}
            {appointment.origin === "desk"
              ? "Reservado no balcão"
              : "Agendado pelo site"}
          </p>
        </section>

        {guide?.howTo && guide.howTo.length > 0 && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground">
              Como fazer
            </h3>
            {guide.note && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {guide.note}
              </p>
            )}
            <ol className="mt-3 flex list-decimal flex-col gap-2.5 pl-5 text-sm text-foreground">
              {guide.howTo.map((item) => (
                <li key={item.step}>
                  {item.step}
                  <span className="block text-xs text-muted-foreground">
                    Fonte: {item.source}
                  </span>
                </li>
              ))}
            </ol>
            {guide.chargedByFeeTable && (
              <div className="mt-3">
                <FeeTableReminder
                  table={feeTable}
                  canUpdate={can(
                    session.user.role ?? "",
                    "transparency.manage",
                    session.user.permissions,
                  )}
                />
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border bg-card px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            O que o cliente informou
          </h3>
          <p className="mt-1.5 whitespace-pre-line [overflow-wrap:anywhere] text-sm text-foreground">
            {appointment.serviceDetails?.trim() || "Nenhuma observação."}
          </p>
          <h4 className="mt-3 text-xs font-medium text-muted-foreground">
            Documentos que enviou
          </h4>
          {citizenFiles.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhum documento.
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {citizenFiles.map((file, index) => (
                <li key={file.id}>
                  <a
                    href={`/admin/agenda/arquivo?id=${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary hover:underline"
                  >
                    Documento {index + 1}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Anotações internas
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Só a serventia vê. O cliente não recebe.
          </p>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg bg-muted/50 px-3.5 py-2.5"
                >
                  <p className="whitespace-pre-line [overflow-wrap:anywhere] text-sm text-foreground">
                    {note.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.authorName} · {DATE_TIME.format(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <NoteForm id={appointment.id} />
        </section>

        <section className="rounded-xl border bg-card px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Anexos da serventia
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Arquivos guardados com o agendamento. O cliente não vê.
          </p>
          {officeFiles.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {officeFiles.map((file, index) => (
                <li key={file.id} className="text-xs">
                  <a
                    href={`/admin/agenda/arquivo?id=${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    Anexo {index + 1}
                  </a>{" "}
                  <span className="text-muted-foreground">
                    · {DATE_TIME.format(file.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <OfficeFilesForm id={appointment.id} />
        </section>

        {appointment.protocolNumber && (
          <DemoHeldEmails
            tenant={tenant}
            related={{
              kind: "appointment",
              protocol: appointment.protocolNumber,
            }}
          />
        )}

        <section className="rounded-xl border bg-card px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Dados do cliente
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Corrija o que o cliente preencheu errado. Dia e horário não mudam
            aqui: para mudar, cancele e reserve de novo.
          </p>
          <CorrectionForm
            id={appointment.id}
            initial={{
              citizenName: appointment.citizenName,
              email: appointment.email,
              phone: appointment.phone,
              cpf: appointment.cpf ?? "",
              serviceId: appointment.serviceId,
              mode: appointment.mode,
              serviceDetails: appointment.serviceDetails ?? "",
            }}
            services={services}
            modes={modeOptions}
          />
        </section>
      </main>
    </>
  );
}
