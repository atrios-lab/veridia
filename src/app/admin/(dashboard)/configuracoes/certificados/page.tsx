import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { maskHolderDocument } from "@/core/signature/policy.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  listCertificatesWith,
  officeSignerCandidatesWith,
} from "@/lib/signing.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import {
  AddCertificateForm,
  CertificateSigners,
  DisableCertificate,
} from "./certificate-forms.tsx";

export const metadata = { title: "Certificados digitais" };

const DAY = 24 * 60 * 60 * 1000;

export default async function CertificatesPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();
  const tenant = await getTenant();
  const [certificates, people] = await Promise.all([
    listCertificatesWith(db, tenant.slug),
    officeSignerCandidatesWith(db, tenant.slug),
  ]);
  const now = Date.now();

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={session.user.role ?? ""} />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Certificados digitais (A1)
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Cadastre os certificados A1 da serventia, e-CPF do titular e dos
            substitutos ou e-CNPJ, e escolha quem pode assinar com cada um no
            Assinador digital (Utilitários). O arquivo fica guardado
            criptografado. A senha do certificado não é guardada: quem assina
            digita a senha a cada assinatura, como o PIN de um token.
          </p>
        </section>

        {certificates.map((certificate) => {
          const expired = certificate.notAfter.getTime() <= now;
          const ending =
            !expired && certificate.notAfter.getTime() - now < 30 * DAY;
          const off = Boolean(certificate.disabledAt);
          return (
            <section
              key={certificate.id}
              aria-labelledby={`cert-${certificate.id}`}
              className={`rounded-[14px] border bg-admin-card px-5 py-4 ${off || expired ? "border-admin-border opacity-70" : ending ? "border-admin-warning-text" : "border-admin-border"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3
                    id={`cert-${certificate.id}`}
                    className="font-serif text-[16px] font-semibold text-admin-primary"
                  >
                    {certificate.label}
                  </h3>
                  <p className="mt-0.5 text-[13px] text-admin-text">
                    {certificate.holderName}
                    {certificate.holderDocument &&
                      ` · ${certificate.kind === "cnpj" ? "CNPJ" : "CPF"} ${maskHolderDocument(certificate.holderDocument)}`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-admin-muted">
                    Emitido por {certificate.issuerName} · válido até{" "}
                    {formatOfficeDate(certificate.notAfter)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${off ? "bg-admin-input-bg text-admin-muted" : expired ? "bg-admin-error-bg text-admin-error-text" : ending ? "bg-admin-warning-bg text-admin-warning-text" : "bg-admin-success-bg text-admin-success-text"}`}
                >
                  {off
                    ? "Desativado"
                    : expired
                      ? "Vencido"
                      : ending
                        ? "Vence em menos de 30 dias"
                        : "Ativo"}
                </span>
              </div>
              {!off && !expired && (
                <CertificateSigners
                  certificateId={certificate.id}
                  people={people}
                  allowed={certificate.signers.map((s) => s.userId)}
                />
              )}
              {!off && <DisableCertificate certificateId={certificate.id} />}
            </section>
          );
        })}

        <AddCertificateForm />
      </main>
    </>
  );
}
