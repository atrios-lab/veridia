import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  formatVerificationCode,
  ICP_POLICY,
  maskHolderDocument,
  SIGNATURE_COMPLIANCE_NOTE,
  SIGNATURE_LEGAL_BASIS,
} from "@/core/signature/policy.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { isVerifyRateLimited } from "@/lib/rate-limit.ts";
import { findSignedDocumentWith } from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { Icon } from "../../_components/icon.tsx";
import { TooManyLookups } from "../limited.tsx";

export const metadata = {
  title: "Documento assinado",
  // A document's page is for whoever holds its code, not for search engines.
  robots: { index: false, follow: false },
};

export default async function SignedDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ arquivo?: string }>;
}) {
  if (await isVerifyRateLimited(await headers())) return <TooManyLookups />;
  const tenant = await getTenant();
  const { codigo } = await params;
  const { arquivo } = await searchParams;
  const view = await findSignedDocumentWith(db, tenant.slug, {
    code: decodeURIComponent(codigo),
  });
  if (!view) {
    if (/^[0-9a-z-]{4,20}$/i.test(codigo))
      redirect(`/verificar?codigo=${encodeURIComponent(codigo)}`);
    notFound();
  }
  const code = formatVerificationCode(view.code);
  const hashes = new Set([
    view.originalSha256,
    ...view.signatures.map((s) => s.resultSha256),
  ]);
  const sent = arquivo?.toLowerCase();
  const fileChecked = sent ? hashes.has(sent) : null;
  const latest = view.signatures.at(-1)?.resultSha256 === sent;
  const original = view.originalSha256 === sent;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-10 md:py-10">
      <Link
        href="/verificar"
        className="text-sm text-brand-muted hover:text-brand-primary"
      >
        ‹ Verificar outro documento
      </Link>
      <div className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-brand-open bg-brand-surface px-5 py-4">
        <Icon name="shield" className="mt-1 h-6 w-6 shrink-0 text-brand-open" />
        <div>
          <p className="font-serif text-xl font-semibold text-brand-primary">
            Documento autêntico, assinado digitalmente
          </p>
          <p className="mt-1 text-sm text-brand-text-soft">
            Código <strong className="tracking-[0.08em]">{code}</strong> ·{" "}
            {view.signatures.length === 1
              ? "1 assinatura"
              : `${view.signatures.length} assinaturas`}{" "}
            com certificado ICP-Brasil, registrado pelo {tenant.name}.
          </p>
        </div>
      </div>

      {fileChecked !== null && (
        <p
          className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${fileChecked ? "bg-brand-tint text-brand-primary" : "bg-brand-attention/15 text-brand-alert"}`}
        >
          {!fileChecked
            ? "O arquivo que você enviou não é idêntico a este documento."
            : latest
              ? "O arquivo que você enviou é idêntico à versão mais recente deste documento assinado."
              : original
                ? "O arquivo que você enviou é o original, antes da assinatura. A versão com validade é a assinada, que traz a faixa e o QR Code."
                : "O arquivo que você enviou é uma versão deste documento antes de alguma das assinaturas abaixo."}
        </p>
      )}

      <section className="mt-5 rounded-2xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-serif text-lg font-semibold text-brand-primary">
          {view.title}
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-brand-faint">Páginas do original</dt>
            <dd className="text-brand-text">{view.pageCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-faint">Primeira assinatura</dt>
            <dd className="text-brand-text">
              {formatOfficeDate(view.createdAt)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-brand-faint">SHA-256 do original</dt>
            <dd className="font-mono text-[12px] text-brand-text [overflow-wrap:anywhere]">
              {view.originalSha256}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-4">
        <h2 className="font-serif text-lg font-semibold text-brand-primary">
          Assinaturas
        </h2>
        <ol className="mt-2 flex flex-col gap-3">
          {view.signatures.map((signature, index) => (
            <li
              key={`${signature.serialHex}-${signature.signedAt.toISOString()}`}
              className="rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm"
            >
              <p className="font-semibold text-brand-primary">
                {index + 1}. {signature.holderName}
                {signature.holderDocument && (
                  <span className="font-normal text-brand-muted">
                    {" "}
                    · {signature.holderDocument.length === 14 ? "CNPJ" : "CPF"}{" "}
                    {maskHolderDocument(signature.holderDocument)}
                  </span>
                )}
              </p>
              <p className="mt-1 text-brand-text-soft">
                Assinado em {formatOfficeDateTime(signature.signedAt)} (horário
                de Brasília), com certificado emitido por {signature.issuerName}
                , nº de série {signature.serialHex.toUpperCase()}.
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={`/verificar/${view.code}/manifesto`}
          className="btn btn-primary btn-lg"
        >
          <Icon name="download" className="h-4 w-4" />
          Baixar manifesto de assinaturas
        </a>
        {view.filePath ? (
          <a
            href={`/verificar/${view.code}/documento`}
            className="btn btn-secondary btn-lg"
          >
            <Icon name="file" className="h-4 w-4" />
            Baixar documento assinado
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-[12.5px] text-brand-muted">
        {view.filePath
          ? `O documento assinado fica disponível para baixar até ${formatOfficeDate(view.fileExpiresAt)}. O registro da assinatura e o manifesto ficam sempre.`
          : view.removedAt
            ? "A serventia retirou o arquivo assinado. O registro da assinatura e o manifesto continuam aqui. Para conferir uma cópia que você tem, envie o PDF na página de verificação."
            : "O arquivo assinado já não está no sistema (prazo de 6 meses). O registro da assinatura e o manifesto continuam aqui. Para conferir uma cópia que você tem, envie o PDF na página de verificação."}
      </p>

      <div className="mt-6 rounded-2xl bg-brand-tint px-4 py-3 text-[12.5px] leading-relaxed text-brand-primary">
        <p>
          Assinatura digital no padrão PAdES, política {ICP_POLICY.label}, com a
          validade jurídica da assinatura qualificada ({SIGNATURE_LEGAL_BASIS}).
          Também pode ser conferida em{" "}
          <a
            href="https://validar.iti.gov.br"
            target="_blank"
            rel="noopener"
            className="font-semibold underline"
          >
            validar.iti.gov.br
          </a>
          .
        </p>
        <p className="mt-1.5">{SIGNATURE_COMPLIANCE_NOTE}</p>
      </div>
    </div>
  );
}
