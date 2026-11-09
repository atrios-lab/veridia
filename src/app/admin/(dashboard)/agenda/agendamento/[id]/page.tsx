import Link from "next/link";
import { notFound } from "next/navigation";
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
import { servicesOfAgenda } from "@/core/scheduling/services.ts";
import {
  findAppointmentById,
  getAgendaConfig,
  listAppointmentAttachments,
  listAppointmentNotes,
} from "@/lib/appointments.ts";
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
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();
  const { id } = await params;
  const appointment = await findAppointmentById(tenant.slug, id);
  if (!appointment) notFound();

  const agenda = agendaIdOf(appointment.agenda);
  const [config, files, notes] = await Promise.all([
    getAgendaConfig(tenant.slug),
    listAppointmentAttachments(tenant.slug, [appointment.id]).catch(() => []),
    listAppointmentNotes(tenant.slug, appointment.id).catch(() => []),
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
      <AdminPageHeader title="Detalhes do agendamento" />
      <main className="flex max-w-[960px] flex-col gap-4.5 px-[30px] py-7">
        <Link
          href={dayHref}
          className="text-[12.5px] font-semibold text-admin-muted hover:underline"
        >
          ‹ Agenda do dia
        </Link>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[18px] font-semibold text-admin-primary">
            {appointment.citizenName}
          </h2>
          <p className="mt-1 text-[13px] text-admin-text">
            {formatFullDate(appointment.date)}, das {appointment.slotTime} às{" "}
            {slotEndTime(appointment.slotTime)} · {AGENDA_NAMES[agenda].name} ·{" "}
            {appointmentStatusLabel(appointment.status)}
            {appointment.protocolNumber && ` · ${appointment.protocolNumber}`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-admin-muted">
            {appointment.serviceLabel} · {appointment.mode} ·{" "}
            {appointment.origin === "desk"
              ? "Reservado no balcão"
              : "Agendado pelo site"}
          </p>
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h3 className="text-[13px] font-bold text-admin-primary">
            O que o cliente informou
          </h3>
          <p className="mt-1.5 whitespace-pre-line [overflow-wrap:anywhere] text-[13px] text-admin-text">
            {appointment.serviceDetails?.trim() || "Nenhuma observação."}
          </p>
          <h4 className="mt-3 text-[12px] font-bold text-admin-muted">
            Documentos que enviou
          </h4>
          {citizenFiles.length === 0 ? (
            <p className="mt-1 text-[12.5px] text-admin-faint">
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
                    className="rounded-full bg-admin-input-bg px-2.5 py-1 text-[12px] font-semibold text-admin-primary hover:underline"
                  >
                    Documento {index + 1}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h3 className="text-[13px] font-bold text-admin-primary">
            Anotações internas
          </h3>
          <p className="mt-0.5 text-[12px] text-admin-muted">
            Só a serventia vê. O cliente não recebe.
          </p>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg bg-admin-input-bg px-3.5 py-2.5"
                >
                  <p className="whitespace-pre-line [overflow-wrap:anywhere] text-[13px] text-admin-text">
                    {note.body}
                  </p>
                  <p className="mt-1 text-[11.5px] text-admin-faint">
                    {note.authorName} · {DATE_TIME.format(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <NoteForm id={appointment.id} />
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h3 className="text-[13px] font-bold text-admin-primary">
            Anexos da serventia
          </h3>
          <p className="mt-0.5 text-[12px] text-admin-muted">
            Arquivos guardados com o agendamento. O cliente não vê.
          </p>
          {officeFiles.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {officeFiles.map((file, index) => (
                <li key={file.id} className="text-[12.5px]">
                  <a
                    href={`/admin/agenda/arquivo?id=${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-admin-primary hover:underline"
                  >
                    Anexo {index + 1}
                  </a>{" "}
                  <span className="text-admin-faint">
                    · {DATE_TIME.format(file.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <OfficeFilesForm id={appointment.id} />
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h3 className="text-[13px] font-bold text-admin-primary">
            Dados do cliente
          </h3>
          <p className="mt-0.5 text-[12px] text-admin-muted">
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
