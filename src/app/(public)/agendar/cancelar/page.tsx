import Link from "next/link";
import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { formatLongDate } from "@/core/scheduling/calendar.ts";
import { findByCancelToken } from "@/lib/appointments.ts";
import { Icon } from "../../_components/icon.tsx";
import { requireSection } from "../../_lib/section.ts";
import { CancelConfirmation } from "./cancel-confirmation.tsx";

export const metadata = { title: "Cancelar agendamento" };

/**
 * The other end of the link in the confirmation e-mail. It shows what is
 * about to be cancelled and asks once more: a GET that cancelled on its own
 * would fire the moment a mail client prefetched the link.
 *
 * A token that matches nothing gets the same neutral answer as one already
 * used. There is nothing to enumerate here — the token is 256 bits — but the
 * screen must not become a way to learn whether an appointment exists.
 */
export default async function CancelAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const tenant = await requireSection("agendamento");
  const { token } = await searchParams;

  const appointment = token
    ? await findByCancelToken(tenant.slug, token)
    : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-10 md:py-14">
      {appointment ? (
        <CancelConfirmation
          token={token ?? ""}
          when={`${formatLongDate(appointment.date)}, das ${appointment.slotTime} às ${slotEndTime(appointment.slotTime)}`}
          serviceLabel={appointment.serviceLabel}
          citizenName={appointment.citizenName}
        />
      ) : (
        <div className="rounded-2xl border border-brand-border bg-brand-card p-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint">
            <Icon
              name="info"
              className="h-6 w-6 text-brand-accent"
              strokeWidth={2}
            />
          </span>
          <h1 className="mt-3 font-serif text-[22px] font-semibold text-brand-primary">
            Este link não vale mais
          </h1>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-brand-muted">
            O agendamento já foi cancelado, já foi atendido, ou o endereço veio
            incompleto. Se precisar de um horário, é só marcar de novo.
          </p>
          <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-center">
            <Link href="/agendar" className="btn btn-primary btn-lg">
              Ver horários livres
            </Link>
            <Link href="/contato" className="btn btn-secondary btn-lg">
              Falar com a serventia
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
