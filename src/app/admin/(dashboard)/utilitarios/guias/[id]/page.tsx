import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print";
import { can } from "@/core/auth/roles.ts";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { formatGuideNumber, retentionEnds } from "@/core/guides/schema.ts";
import {
  brDate,
  GUIDE_STATUS_LABELS,
  guidePaymentOverdue,
  guideStatusOf,
  guideStatusSummary,
} from "@/core/guides/status.ts";
import { statusLabel } from "@/core/request/kinds.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
} from "@/core/time/office-time.ts";
import { findById } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideStatus } from "@/lib/tax-guide-status.ts";
import { findGuide, getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { GuideForm } from "../guide-form.tsx";
import { GuideNumber } from "./guide-number.tsx";
import { GuideStatusCard, type GuideStatusView } from "./guide-status-card.tsx";

export const metadata = { title: "Guia de transmissão de bens" };

/** One guia: its files, and the same form to correct it (same number). */
export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emitida?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const { id } = await params;
  const [stored, settings] = await Promise.all([
    findGuide(tenant.slug, id),
    getGuideSettings(tenant),
  ]);
  if (!stored) notFound();
  const number = formatGuideNumber(stored.year, stored.sequence);
  const canCommunicate = can(
    session.user.role ?? "",
    "titularidade.manage",
    session.user.permissions,
  );
  const base = `/admin/utilitarios/guias/${stored.id}/arquivo`;
  const issued = (await searchParams).emitida === "1";
  const [statusRecord, request] = await Promise.all([
    getGuideStatus(tenant.slug, stored.id),
    stored.serviceRequestId
      ? findById(tenant.slug, stored.serviceRequestId)
      : Promise.resolve(undefined),
  ]);
  const receiptBase = `/admin/utilitarios/guias/${stored.id}/comprovante`;
  const current = statusRecord.current;
  const statusView: GuideStatusView = {
    status: guideStatusOf(statusRecord),
    dueOn: current?.dueOn ?? "",
    paidOn: current?.paidOn ?? "",
    concludedOn: current?.concludedOn ?? "",
    note: current?.note ?? "",
    receipt: current?.receipt
      ? {
          displayName: current.receipt.displayName,
          href: `${receiptBase}?arquivo=${encodeURIComponent(current.receipt.storedName)}`,
        }
      : null,
    summary: guideStatusSummary(statusRecord),
    saved: Boolean(current) || statusRecord.history.length > 0,
    history: [...statusRecord.history].reverse().map((h) => ({
      at: formatOfficeDateTime(new Date(h.at)),
      text: `${
        h.change === "withdrawn"
          ? "voltou para aguardando pagamento; antes"
          : h.change === "receipt-removed"
            ? "comprovante retirado"
            : "alterada; antes"
      }: ${GUIDE_STATUS_LABELS[h.status]}${h.paidOn ? `, paga em ${brDate(h.paidOn)}` : ""}${h.concludedOn ? `, usada no ato em ${brDate(h.concludedOn)}` : ""}`,
      receiptHref: h.receipt
        ? `${receiptBase}?arquivo=${encodeURIComponent(h.receipt.storedName)}`
        : null,
    })),
  };
  const todayIso = today();

  return (
    <>
      <AdminPageHeader maxWidth={1100} title={`Guia nº ${number}`} />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/guias"
          label="Guias de transmissão de bens"
        />
        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-foreground">
              {GUIDE_KIND_INFO[stored.guide.kind].label} · nº {number}
            </p>
            <p className="text-xs text-muted-foreground">
              {issued
                ? "Guia emitida. Baixe, confira, assine e entregue à parte."
                : "Corrija abaixo se precisar: o número continua o mesmo."}
            </p>
          </div>
          <SignOrPrint
            pdfHref={`${base}?formato=pdf`}
            title={`Guia nº ${number}`}
          />
          <a
            href={`${base}?formato=docx`}
            className={buttonVariants({ variant: "outline" })}
          >
            <AdminIcon name="file" className="h-4 w-4" /> Word (editável)
          </a>
        </section>
        {request && (
          <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-3 text-sm">
            <AdminIcon name="inbox" className="h-4 w-4 text-primary" />
            <p className="mr-auto">
              Esta guia é do pedido{" "}
              <strong className="tabular-nums">{request.protocolNumber}</strong>
              , feito pelo site. Andamento do pedido:{" "}
              <strong>{statusLabel("service-request", request.status)}</strong>.
              É um atendimento só: o pedido é o que o cliente acompanha pelo
              site, e a guia é o documento que sai dele.
            </p>
            <a
              href={`/admin/pedidos/${encodeURIComponent(request.protocolNumber)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Abrir o pedido
            </a>
          </section>
        )}
        <GuideStatusCard
          guideId={stored.id}
          view={statusView}
          today={todayIso}
          keptUntil={formatOfficeDate(retentionEnds(stored.createdAt))}
          overdue={guidePaymentOverdue(statusRecord, todayIso)}
        />
        {canCommunicate && stored.guide.kind !== "certidao-imobiliaria" && (
          <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                Deseja gerar a comunicação à prefeitura e a DOI com estes dados?
              </p>
              <p className="text-muted-foreground text-justify hyphens-auto">
                Depois de lavrada a escritura, a mudança de titularidade vai na
                Carga CTP do mês à prefeitura (Código Nacional de Normas, art.
                184-A) e na DOI. As partes, o imóvel e o valor desta guia já
                entram preenchidos; falta só a data, o livro e as folhas.
              </p>
            </div>
            <a
              href={`/admin/utilitarios/titularidade/nova?guia=${stored.id}`}
              className={buttonVariants()}
            >
              Sim, gerar a comunicação
            </a>
          </section>
        )}
        <GuideNumber
          id={stored.id}
          year={stored.year}
          sequence={stored.sequence}
        />
        <GuideForm initial={stored.guide} id={stored.id} settings={settings} />
      </main>
    </>
  );
}
