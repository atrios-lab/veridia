import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  certificateSentence,
  formatCertificateDate,
  normalizeCertificateCode,
  publicCpf,
} from "@/core/courses/certificate.ts";
import { certificateByCode } from "@/lib/certificates.ts";
import { isCertificateRateLimited } from "@/lib/rate-limit.ts";

// Never in a search index: the page is for someone holding the code.
export const metadata: Metadata = {
  title: "Validação de certificado",
  robots: { index: false, follow: false },
};

/**
 * The public check of a course certificate, on any office's host: who, what
 * course, when, the CPF masked. A malformed code and one that does not
 * exist get the same 404, so the page never says which.
 */
export default async function CertificateCheckPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  if (await isCertificateRateLimited(await headers())) {
    return (
      <Frame>
        <h1 className="font-serif text-[24px] font-semibold text-brand-primary">
          Muitas consultas seguidas
        </h1>
        <p className="mt-2 text-[15px] text-brand-muted">
          Espere alguns minutos e tente de novo.
        </p>
      </Frame>
    );
  }
  const { codigo } = await params;
  const code = normalizeCertificateCode(decodeURIComponent(codigo));
  const certificate = code ? await certificateByCode(code) : undefined;
  if (!certificate) notFound();

  return (
    <Frame>
      <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-3 py-1 text-[12.5px] font-bold text-white">
        Certificado válido
      </span>
      <h1 className="mt-4 font-serif text-[26px] leading-tight font-semibold text-brand-primary">
        {certificate.fullName}
      </h1>
      <p className="mt-1 text-[14px] text-brand-muted">
        CPF {publicCpf(certificate.cpf)} · {certificate.roleTitle} ·{" "}
        {certificate.tenantName}
      </p>
      <p className="mt-5 font-serif text-[17px] leading-relaxed text-brand-text">
        {certificateSentence(certificate, "public")}
      </p>
      <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-brand-border pt-5 text-[14px] sm:grid-cols-2">
        <div>
          <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-faint">
            Código
          </dt>
          <dd className="font-mono text-brand-primary">{certificate.code}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-faint">
            Emitido em
          </dt>
          <dd className="text-brand-text">
            {formatCertificateDate(certificate.issuedAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-5 text-[13px] text-brand-muted">
        O PDF deste certificado é assinado digitalmente pela Átrios com
        certificado ICP-Brasil. Qualquer alteração no arquivo invalida a
        assinatura.
      </p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <div className="rounded-[16px] border border-brand-border bg-brand-card p-6 md:p-9">
        {children}
      </div>
    </div>
  );
}
