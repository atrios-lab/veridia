import { can } from "@/core/auth/roles.ts";
import {
  receiptFileName,
  renderAppointmentReceipt,
} from "@/lib/appointment-receipt.ts";
import { findAppointmentById } from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The receipt printed at the counter, for a visit the office reserved by
 * phone or for a citizen who arrived without theirs. GET and no token: the
 * operator is authenticated by the session, same as the requerimento print.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  ) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const appointment = await findAppointmentById(tenant.slug, (await params).id);
  if (!appointment) return new Response("Não encontrado", { status: 404 });

  const bytes = await renderAppointmentReceipt(
    tenant,
    appointment,
    new URL(request.url).origin,
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // Inline: the operator opens it to print, not to file it away.
      "Content-Disposition": `inline; filename="${receiptFileName(appointment)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
