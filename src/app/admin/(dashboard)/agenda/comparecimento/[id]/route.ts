import { can } from "@/core/auth/roles.ts";
import {
  declarationFileName,
  renderAttendanceDeclaration,
} from "@/lib/appointment-receipt.ts";
import { findAppointmentById } from "@/lib/appointments.ts";
import { canDeclareAttendance } from "@/lib/attendance-declaration.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The attendance declaration, printed at the counter to be signed and
 * stamped. Only for an appointment marked attended in person: the document
 * says the citizen was here, and nothing else is evidence of that.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) {
    return new Response("Não autorizado", { status: 403 });
  }
  const tenant = await getTenant();
  const appointment = await findAppointmentById(tenant.slug, (await params).id);
  if (!appointment) return new Response("Não encontrado", { status: 404 });
  if (!canDeclareAttendance(appointment)) {
    return new Response(
      "A declaração só sai para um atendimento presencial marcado como atendido.",
      { status: 409 },
    );
  }

  const bytes = await renderAttendanceDeclaration(
    tenant,
    appointment,
    new URL(request.url).origin,
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${declarationFileName(appointment)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
