import type { Metadata } from "next";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { findAppointmentById } from "@/lib/appointments.ts";
import { verifyAttendanceToken } from "@/lib/attendance-code.ts";
import { canDeclareAttendance } from "@/lib/attendance-declaration.ts";
import { getTenant } from "@/lib/tenant.ts";
import { Icon } from "../../_components/icon.tsx";

export const metadata: Metadata = {
  title: "Validação de declaração de comparecimento",
  // A validation answers whoever holds the paper; it is not a page to find.
  robots: { index: false, follow: false },
};

/** "Maria José da Silva" → "Maria J. da S.": enough for whoever holds the
 * paper to match it, not a full name handed to anyone with the link. */
function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [
    first,
    ...rest.map((part) =>
      ["da", "de", "do", "das", "dos", "e"].includes(part.toLowerCase())
        ? part
        : `${part[0]}.`,
    ),
  ].join(" ");
}

/**
 * Where the QR of an attendance declaration leads, on the office's own site:
 * whether the paper in someone's hand matches an appointment the office
 * marked attended. The code in the address is an HMAC (attendance-code.ts),
 * so a made-up address answers "não encontrada", never someone else's visit.
 */
export default async function AttendanceValidationPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const tenant = await getTenant();
  const token = decodeURIComponent((await params).codigo);
  const id = verifyAttendanceToken(tenant.slug, token);
  const appointment = id
    ? await findAppointmentById(tenant.slug, id)
    : undefined;
  const valid = appointment && canDeclareAttendance(appointment);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-10">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        Validação de documento
      </span>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
        Declaração de comparecimento
      </h1>

      {valid ? (
        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-card p-5">
          <p className="flex items-center gap-2 text-[15px] font-bold text-brand-primary">
            <Icon
              name="check"
              className="h-5 w-5 text-brand-accent"
              strokeWidth={2.4}
            />
            Declaração válida
          </p>
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-[13.5px]">
            <dt className="text-brand-muted">Serventia</dt>
            <dd className="text-brand-text">{tenant.name}</dd>
            <dt className="text-brand-muted">CNS</dt>
            <dd className="text-brand-text">{tenant.cns}</dd>
            <dt className="text-brand-muted">Pessoa</dt>
            <dd className="text-brand-text">
              {shortName(appointment.citizenName)}
            </dd>
            <dt className="text-brand-muted">Dia</dt>
            <dd className="text-brand-text">{formatDate(appointment.date)}</dd>
            <dt className="text-brand-muted">Horário</dt>
            <dd className="text-brand-text">
              {appointment.slotTime} às {slotEndTime(appointment.slotTime)}
            </dd>
            {appointment.protocolNumber && (
              <>
                <dt className="text-brand-muted">Protocolo</dt>
                <dd className="text-brand-text">
                  {appointment.protocolNumber}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-4 text-[12.5px] leading-relaxed text-brand-muted">
            A serventia registrou o comparecimento desta pessoa no dia e horário
            acima. Confira se os dados batem com a declaração impressa, que deve
            estar assinada e carimbada.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-[1.5px] border-brand-alert bg-brand-card p-5">
          <p className="text-[15px] font-bold text-brand-alert">
            Declaração não encontrada
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted">
            Este código não corresponde a um comparecimento registrado por{" "}
            {tenant.name}. Confira o endereço ou fale com a serventia pelo
            e-mail {tenant.contacts.email} ou pelo telefone{" "}
            {tenant.contacts.phone}.
          </p>
        </div>
      )}
    </div>
  );
}
