import { slotEndTime } from "@/core/scheduling/agenda.ts";
import { buildCalendarEvent } from "@/core/scheduling/ics.ts";
import { findByCancelToken } from "@/lib/appointments.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the form carries the appointment's token, and a token in the
 * query string ends up in the address bar, in the browser history and in every
 * log between here and the citizen. The same file also travels attached to
 * the confirmation e-mail, where a link is unavoidable.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const token = String(form.get("token") ?? "");

  const appointment = token
    ? await findByCancelToken(tenant.slug, token)
    : undefined;
  if (!appointment) {
    return new Response("Não encontrado", { status: 404 });
  }

  const ics = buildCalendarEvent(
    {
      uid: `agendamento-${appointment.id}@${tenant.slug}`,
      date: appointment.date,
      startTime: appointment.slotTime,
      endTime: slotEndTime(appointment.slotTime),
      title: `Atendimento no ${tenant.name}`,
      description:
        `${appointment.serviceLabel} · ${appointment.mode}. ` +
        "Leve um documento com foto.",
      location: tenant.address ?? `${tenant.name}, ${tenant.subtitle}`,
      stamp: new Date(),
    },
    OFFICE_TIME_ZONE,
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento-${appointment.date}.ics"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
