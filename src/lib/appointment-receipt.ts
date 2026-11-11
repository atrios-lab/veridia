import "server-only";
import { agendaIdOf } from "@/core/scheduling/agenda.ts";
import { buildAppointmentReceipt } from "@/core/scheduling/receipt.ts";
import {
  checklistFileHref,
  resolveService,
} from "@/core/scheduling/services.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { type Appointment, getAgendaConfig } from "./appointments.ts";
import {
  attendanceDeclarationFor,
  canDeclareAttendance,
} from "./attendance-declaration.ts";
import { brandFor } from "./document-brand.ts";
import { renderDocument, renderDocuments } from "./pdf.ts";

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
  const receipt = await appointmentReceiptDocument(tenant, appointment, origin);
  // Once the office marked the citizen attended, the receipt printed at the
  // counter carries the attendance declaration as its second page, and the
  // QR on both leads to the declaration's validation.
  if (canDeclareAttendance(appointment)) {
    const declaration = attendanceDeclarationFor(tenant, appointment, origin);
    return renderDocuments(
      [receipt, declaration.document],
      await brandFor(tenant, declaration.url),
    );
  }
  return renderDocument(receipt, await brandFor(tenant, `${origin}/protocolo`));
}

/** The declaration alone, for the panel's own button. */
export async function renderAttendanceDeclaration(
  tenant: Tenant,
  appointment: Appointment,
  origin: string,
  signer?: { name: string; title: string },
): Promise<Buffer> {
  const declaration = attendanceDeclarationFor(
    tenant,
    appointment,
    origin,
    signer,
  );
  return renderDocument(
    declaration.document,
    await brandFor(tenant, declaration.url),
  );
}

async function appointmentReceiptDocument(
  tenant: Tenant,
  appointment: Appointment,
  origin: string,
) {
  const config = await getAgendaConfig(tenant.slug);
  const known = resolveService(config, appointment.serviceId);
  return buildAppointmentReceipt(tenant, {
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
      checklist: known?.checklist,
    },
    checklistUrl: known?.hasOwnFile
      ? `${origin}${checklistFileHref(known.id)}`
      : undefined,
    createdAt: appointment.createdAt,
  });
}

/** The declaration's file name. */
export function declarationFileName(appointment: Appointment): string {
  return `declaracao-comparecimento-${appointment.protocolNumber ?? appointment.date}.pdf`;
}

/** The file name the browser saves it under. */
export function receiptFileName(appointment: Appointment): string {
  return `comprovante-agendamento-${appointment.protocolNumber ?? appointment.date}.pdf`;
}
