import Link from "next/link";
import { getActForTenant } from "@/core/acts/catalog.ts";
import {
  emptyQualification,
  qualificationFromRequest,
} from "@/core/qualificacao/qualificacao.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { qualificationsOfProtocolWith } from "@/lib/qualificacao.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireQualificacao } from "../_access.ts";
import { NewQualificationForm } from "../qualificacao-forms.tsx";

export const metadata = { title: "Nova qualificação" };

export default async function NewQualificationPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  await requireQualificacao();
  const { pedido = "" } = await searchParams;
  const tenant = await getTenant();
  const request = pedido.trim()
    ? await findByProtocol(tenant.slug, pedido.trim()).catch(() => null)
    : null;
  const act = request?.actId
    ? getActForTenant(tenant, request.actId)
    : undefined;
  const initial = request
    ? qualificationFromRequest({
        protocol: request.protocolNumber,
        applicantName: request.applicantName ?? "",
        contact: request.contact ?? "",
        receivedOn: toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
        attribution: act?.attribution,
        actName: act?.name,
      })
    : emptyQualification("rcpn", today());
  const existing = request
    ? await qualificationsOfProtocolWith(
        db,
        tenant.slug,
        request.protocolNumber,
      )
    : [];
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Nova qualificação"
        description="Lance o título apresentado: quem apresentou, o que é e o ato pedido. As exigências vêm na tela seguinte, da biblioteca ou escritas."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={
            request
              ? `/admin/pedidos/${encodeURIComponent(request.protocolNumber)}`
              : "/admin/utilitarios/qualificacao"
          }
          label={
            request
              ? `Pedido ${request.protocolNumber}`
              : "Qualificação de títulos"
          }
        />
        {request && (
          <p className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground">
            Dados trazidos do pedido {request.protocolNumber}
            {act ? ` (${act.name})` : ""}. Escolha o ato pedido e confira o
            título apresentado.
          </p>
        )}
        {existing.length > 0 && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-5 py-3 text-sm text-foreground">
            Este pedido já tem qualificação:{" "}
            {existing.map((q, i) => (
              <span key={q.id}>
                {i > 0 ? ", " : ""}
                <Link
                  href={`/admin/utilitarios/qualificacao/${q.id}`}
                  className="underline"
                >
                  abrir
                </Link>
              </span>
            ))}
            . Abra outra só se for um título diferente.
          </p>
        )}
        <NewQualificationForm initial={initial} />
      </main>
    </>
  );
}
