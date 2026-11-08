import {
  receiptFileName,
  renderAppointmentReceipt,
} from "@/lib/appointment-receipt.ts";
import { findByCancelToken } from "@/lib/appointments.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The appointment receipt, by POST for the same reason as the calendar file
 * next door: the token is the citizen's only credential, and in a query
 * string it would sit in the address bar, the history and every log.
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

  const bytes = await renderAppointmentReceipt(
    tenant,
    appointment,
    new URL(request.url).origin,
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receiptFileName(appointment)}"`,
      // Personal data: no shared cache may keep a copy.
      "Cache-Control": "private, no-store",
    },
  });
}
