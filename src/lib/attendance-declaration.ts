import "server-only";
import { isRemoteMode } from "@/core/scheduling/agenda.ts";
import { buildAttendanceDeclaration } from "@/core/scheduling/attendance.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Appointment } from "./appointments.ts";
import { attendanceCode, attendanceUrl } from "./attendance-code.ts";
import { officeNow } from "./office-config.ts";

/**
 * Whether an appointment can have an attendance declaration: the office
 * marked it attended, and the citizen came to the counter (a video or phone
 * call is not "compareceu a esta serventia").
 */
export function canDeclareAttendance(
  appointment: Pick<Appointment, "status" | "mode">,
): boolean {
  return appointment.status === "attended" && !isRemoteMode(appointment.mode);
}

/**
 * The office's site by its own domain. The declaration's QR and text point
 * there, never at the address the panel happened to be opened through (a
 * preview, an IP, localhost): the paper outlives the session that printed it.
 */
export function officeSite(
  tenant: Tenant,
  fallbackOrigin: string,
): {
  origin: string;
  domain: string;
} {
  const host = tenant.hosts[0];
  return host
    ? { origin: `https://${host}`, domain: host }
    : { origin: fallbackOrigin, domain: new URL(fallbackOrigin).host };
}

/** The declaration of one appointment, as content, with its QR address. */
export function attendanceDeclarationFor(
  tenant: Tenant,
  appointment: Appointment,
  requestOrigin: string,
) {
  const site = officeSite(tenant, requestOrigin);
  const url = attendanceUrl(site.origin, tenant.slug, appointment.id);
  return {
    url,
    document: buildAttendanceDeclaration(tenant, {
      citizenName: appointment.citizenName,
      cpf: appointment.cpf,
      date: appointment.date,
      slotTime: appointment.slotTime,
      protocolNumber: appointment.protocolNumber,
      issuedOn: officeNow().date,
      siteDomain: site.domain,
      validationCode: attendanceCode(tenant.slug, appointment.id),
    }),
  };
}
