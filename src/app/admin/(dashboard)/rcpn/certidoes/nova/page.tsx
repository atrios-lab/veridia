import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CERTIDAO_FORM_LABELS,
  CERTIDAO_FORMS,
  certidaoModel,
  isCertidaoForm,
  prefillCertidao,
  RN_FEES_NOTE,
} from "@/core/rcpn/certidao.ts";
import { db } from "@/db/index.ts";
import { getRecordWith, isRcpnKind } from "@/lib/rcpn-certidao.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireRcpn } from "../../_lib/access.ts";
import { CertidaoForm } from "../certidao-form.tsx";

export const metadata = { title: "Emitir certidão" };

export default async function NovaCertidaoPage({
  searchParams,
}: {
  searchParams: Promise<{ registro?: string; tipo?: string; via?: string }>;
}) {
  await requireRcpn("rcpn.certidao");
  const tenant = await getTenant();
  const query = await searchParams;
  const record = query.registro
    ? await getRecordWith(db, tenant.slug, String(query.registro))
    : null;
  if (query.registro && !record) notFound();
  const kind = record?.kind ?? query.tipo;
  if (!isRcpnKind(kind)) notFound();
  const form = isCertidaoForm(query.via) ? query.via : "breve";
  const hrefFor = (via: string) =>
    `/admin/rcpn/certidoes/nova?${new URLSearchParams(
      record ? { registro: record.id, via } : { tipo: kind, via },
    )}`;
  const signers = (await getGuideSettings(tenant)).signers.map(
    ({ name, title }) => ({ name, title }),
  );
  const where = record
    ? [
        record.book && `Livro ${record.book}`,
        record.page && `folha ${record.page}`,
        record.term && `termo ${record.term}`,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Emitir ${certidaoModel(kind, form).title.toLowerCase()}`}
        description={
          record
            ? `Preenchida com o que o índice tem${where ? ` (${where})` : ""}. Abra o livro, confira cada campo e complete o que falta.`
            : "Em branco: preencha com o registro do livro."
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={record ? "/admin/rcpn" : "/admin/rcpn/certidoes"}
          label={record ? "Registro Civil" : "Certidões"}
        />
        <nav
          aria-label="Tipo de certidão"
          className="inline-flex w-fit gap-1 rounded-lg border bg-card p-1"
        >
          {CERTIDAO_FORMS.map((via) => (
            <Link
              key={via}
              href={hrefFor(via)}
              aria-current={via === form ? "page" : undefined}
              className={buttonVariants({
                variant: via === form ? "default" : "ghost",
                size: "sm",
              })}
            >
              {CERTIDAO_FORM_LABELS[via]}
            </Link>
          ))}
        </nav>
        <CertidaoForm
          key={form}
          signers={signers}
          initial={{
            recordId: record?.id,
            kind,
            form,
            natimorto: record?.subtype === "natimorto",
            fields: record
              ? prefillCertidao(record, form)
              : { cpf: "NÃO CONSTA" },
            seal: "",
            sealKind: "",
            fees: tenant.location.state === "RN" ? RN_FEES_NOTE : "",
            signerName: "",
            signerTitle: "",
          }}
        />
      </main>
    </>
  );
}
