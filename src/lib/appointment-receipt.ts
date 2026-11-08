import "server-only";
import { agendaIdOf } from "@/core/scheduling/agenda.ts";
import { buildAppointmentReceipt } from "@/core/scheduling/receipt.ts";
import { resolveService } from "@/core/scheduling/services.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Appointment, getAgendaConfig } from "./appointments.ts";
import { brandFor } from "./document-brand.ts";
import { renderDocument } from "./pdf.ts";

/**
 * The receipt of one appointment as a PDF on the office's letterhead, the
 * same for the citizen's download, the e-mail attachment and the panel's
 * print. The QR on the letterhead leads to the protocol lookup, where the
 * AGD number answers whether the appointment still holds.
 */
export async function renderAppointmentReceipt(
  tenant: Tenant,
  appointment: Appointment,
  origin: string,
): Promise<Buffer> {
  const config = await getAgendaConfig(tenant.slug);
  const known = resolveService(config, appointment.serviceId);
  return renderDocument(
    buildAppointmentReceipt(tenant, {
      protocolNumber: appointment.protocolNumber,
      agenda: agendaIdOf(appointment.agenda),
      date: appointment.date,
      slotTime: appointment.slotTime,
      citizenName: appointment.citizenName,
      cpf: appointment.cpf,
      phone: appointment.phone,
      email: appointment.email,
      mode: appointment.mode,
      serviceDetails: appointment.serviceDetails,
      // The label the citizen booked, even if the office renamed it since;
      // the list from wherever the service still lives.
      service: {
        label: appointment.serviceLabel,
        bring: known?.bring ?? [],
        note: known?.note,
      },
      createdAt: appointment.createdAt,
    }),
    await brandFor(tenant, `${origin}/protocolo`),
  );
}

/** The file name the browser saves it under. */
export function receiptFileName(appointment: Appointment): string {
  return `comprovante-agendamento-${appointment.protocolNumber ?? appointment.date}.pdf`;
}
