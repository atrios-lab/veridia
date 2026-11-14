import Link from "next/link";
import { notFound } from "next/navigation";
import { CERTIDAO_FORM_LABELS, isCertidaoForm } from "@/core/rcpn/certidao.ts";
import { RCPN_KIND_LABELS, type RcpnKind } from "@/core/rcpn/record.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import {
  certidaoSubject,
  certidaoTitle,
  getCertidaoWith,
} from "@/lib/rcpn-certidao.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireRcpn } from "../../_lib/access.ts";
import {
  AttachForm,
  CertidaoForm,
  RemoveCertidaoButton,
} from "../certidao-form.tsx";

export const metadata = { title: "Certidão do Registro Civil" };

export default async function CertidaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emitida?: string; corrigida?: string }>;
}) {
  await requireRcpn("rcpn.certidao");
  const tenant = await getTenant();
  const row = await getCertidaoWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const query = await searchParams;
  const kind = row.kind as RcpnKind;
  const subject = certidaoSubject(row);
  const pdfHref = `/admin/rcpn/certidoes/${row.id}/arquivo`;
  const signers = (await getGuideSettings(tenant)).signers.map(
    ({ name, title }) => ({ name, title }),
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`${certidaoTitle(kind, row.form)}${row.subtype === "natimorto" ? " (natimorto)" : ""}`}
        description={subject || undefined}
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn/certidoes" label="Certidões" />
        {(query.emitida || query.corrigida) && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            {query.emitida
              ? "Certidão emitida. Imprima para assinar à mão ou assine digitalmente."
              : "Correção salva. Gere o PDF de novo para imprimir ou assinar."}
          </p>
        )}
        {!row.seal && (
          <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Esta certidão ainda está sem selo. Cole o selo do lote em Corrigir,
            antes de entregar.
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-foreground">
              {RCPN_KIND_LABELS[kind]} ·{" "}
              {
                CERTIDAO_FORM_LABELS[
                  isCertidaoForm(row.form) ? row.form : "breve"
                ]
              }
              {row.seal ? ` · Selo ${row.seal}` : " · sem selo"}
            </p>
            <p className="text-xs text-muted-foreground">
              Emitida em {formatOfficeDateTime(row.createdAt)}
              {row.updatedAt
                ? ` · corrigida em ${formatOfficeDateTime(row.updatedAt)}`
                : ""}
            </p>
          </div>
          <SignOrPrint
            pdfHref={pdfHref}
            title={`${certidaoTitle(kind, row.form)}${subject ? ` de ${subject}` : ""}`}
          />
          <RemoveCertidaoButton id={row.id} />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Certidão assinada
          </h2>
          <p className="text-sm text-muted-foreground">
            Depois de assinar, anexe aqui a via assinada: a digitalizada, se
            assinou à mão, ou o PDF assinado digitalmente. Fica guardada com a
            certidão.
          </p>
          {row.attachmentPath && (
            <p className="text-sm">
              <Link
                href={`/admin/rcpn/certidoes/${row.id}/anexo`}
                target="_blank"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Abrir a anexada ({row.attachmentName ?? "certidão"})
              </Link>
            </p>
          )}
          <AttachForm id={row.id} />
        </section>

        <h2 className="text-lg font-semibold text-foreground">Corrigir</h2>
        <CertidaoForm
          signers={signers}
          initial={{
            id: row.id,
            recordId: row.recordId ?? undefined,
            kind,
            form: isCertidaoForm(row.form) ? row.form : "breve",
            natimorto: row.subtype === "natimorto",
            fields: (row.fields ?? {}) as Record<string, string>,
            seal: row.seal,
            sealKind: row.sealKind,
            fees: row.fees,
            signerName: row.signerName,
            signerTitle: row.signerTitle,
          }}
        />
      </main>
    </>
  );
}
