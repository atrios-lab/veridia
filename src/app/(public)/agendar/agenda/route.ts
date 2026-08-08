import { parseDetails } from "@/core/request/kinds.ts";
import { buildCalendarEvent } from "@/core/scheduling/ics.ts";
import { findByProtocolWithKey } from "@/lib/service-request.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * POST, not GET: the form carries the access key, and a key in the query
 * string ends up in the address bar, in the browser history and in every log
 * between here and the citizen.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = await getTenant();
  const form = await request.formData();
  const protocolNumber = String(form.get("protocolNumber") ?? "");
  const accessKey = String(form.get("accessKey") ?? "");

  // One answer for "no such protocol" and for "wrong key". Telling them apart
  // would let someone confirm a protocol exists by guessing numbers.
  const stored = await findByProtocolWithKey(
    tenant.slug,
    protocolNumber,
    accessKey,
  );
  if (!stored || stored.kind !== "appointment") {
    return new Response("Não encontrado", { status: 404 });
  }

  const details = parseDetails("appointment", stored.details);
  // The office may have proposed another band and the citizen accepted it:
  // the calendar has to carry the hour that is actually valid.
  const date = details.acceptedAt
    ? (details.proposedDate ?? details.date)
    : details.date;
  const hour = details.acceptedAt
    ? (details.proposedSlotHour ?? details.slotHour)
    : details.slotHour;

  const ics = buildCalendarEvent(
    {
      uid: `${stored.protocolNumber}@${tenant.slug}`,
      date,
      startHour: hour,
      endHour: hour + 1,
      title: `Atendimento no ${tenant.name}`,
      description:
        `Protocolo ${stored.protocolNumber}. ` +
        "Leve um documento com foto. A serventia confirma o horário pelo contato informado.",
      location: `${tenant.name}, ${tenant.subtitle}`,
      stamp: new Date(),
    },
    OFFICE_TIME_ZONE,
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento-${stored.protocolNumber}.ics"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
