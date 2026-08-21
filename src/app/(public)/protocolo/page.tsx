import { type RequestKind, statusLabel } from "@/core/request/kinds.ts";
import {
  PROTOCOL_TYPE_LABELS,
  parseProtocolNumber,
} from "@/core/request/protocol.ts";
import { appointmentStatusLabel } from "@/core/scheduling/appointment.ts";
import { findAppointmentByProtocol } from "@/lib/appointments.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { requireSection } from "../_lib/section.ts";
import { ProtocolLookup, type PublicStatus } from "./protocol-lookup.tsx";

export const metadata = { title: "Consultar protocolo" };

export default async function ProtocolLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  const tenant = await requireSection("consulta-protocolo");
  const { numero } = await searchParams;
  // Trimmed and capped: it is echoed back to the page, and an unbounded
  // string from the query is not something to print at full length.
  const protocolNumber = numero?.trim().slice(0, 40);

  let publicStatus: PublicStatus | undefined;
  if (protocolNumber) {
    try {
      const request = await findByProtocol(tenant.slug, protocolNumber);
      // AGD numbers issued after appointments moved to their own table live
      // there, not in service_requests; dormant legacy rows still win above.
      if (!request && parseProtocolNumber(protocolNumber)?.prefix === "AGD") {
        const appointment = await findAppointmentByProtocol(
          tenant.slug,
          protocolNumber,
        );
        if (appointment?.protocolNumber) {
          publicStatus = {
            protocolNumber: appointment.protocolNumber,
            typeLabel: PROTOCOL_TYPE_LABELS.AGD,
            statusLabel: appointmentStatusLabel(appointment.status),
            createdAt: appointment.createdAt.toISOString(),
            updatedAt: appointment.updatedAt.toISOString(),
          };
        }
      }
      if (request) {
        const parsed = parseProtocolNumber(request.protocolNumber);
        publicStatus = {
          protocolNumber: request.protocolNumber,
          typeLabel:
            (parsed &&
              PROTOCOL_TYPE_LABELS[
                parsed.prefix as keyof typeof PROTOCOL_TYPE_LABELS
              ]) ??
            "Pedido de serviço",
          statusLabel: statusLabel(request.kind as RequestKind, request.status),
          createdAt: request.createdAt.toISOString(),
          updatedAt: request.updatedAt.toISOString(),
        };
      }
    } catch (error) {
      // Never surface a database hiccup to a citizen looking up their own
      // request: it reads the same as "not found" from here.
      console.error("protocolo.public-status", error);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-10 md:py-16">
      <ProtocolLookup
        tenantName={tenant.name}
        initialNumber={protocolNumber}
        publicStatus={publicStatus}
        notFound={Boolean(protocolNumber) && !publicStatus}
        contacts={tenant.contacts}
      />
    </div>
  );
}
