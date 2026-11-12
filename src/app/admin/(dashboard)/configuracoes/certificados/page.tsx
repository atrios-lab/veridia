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
import { Badge } from "../../../_ui/badge.tsx";
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
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "certificates.manage",
      session.user.permissions,
    )
  )
    notFound();
  const tenant = await getTenant();
  const [certificates, people] = await Promise.all([
    listCertificatesWith(db, tenant.slug),
    officeSignerCandidatesWith(db, tenant.slug),
  ]);
  const now = Date.now();

  return (
    <>
      <AdminPageHeader maxWidth={860} title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Certificados digitais (A1)
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
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
              className={`rounded-xl border bg-card px-5 py-4 ${off || expired ? "opacity-70" : ending ? "border-warning" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3
                    id={`cert-${certificate.id}`}
                    className="text-base font-semibold text-foreground"
                  >
                    {certificate.label}
                  </h3>
                  <p className="mt-0.5 text-sm text-foreground">
                    {certificate.holderName}
                    {certificate.holderDocument &&
                      ` · ${certificate.kind === "cnpj" ? "CNPJ" : "CPF"} ${maskHolderDocument(certificate.holderDocument)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Emitido por {certificate.issuerName} · válido até{" "}
                    {formatOfficeDate(certificate.notAfter)}
                  </p>
                </div>
                <Badge
                  variant={off ? "outline" : "default"}
                  className={
                    off
                      ? "text-muted-foreground"
                      : expired
                        ? "bg-destructive text-destructive-foreground"
                        : ending
                          ? "bg-warning text-warning-foreground"
                          : "bg-success text-success-foreground"
                  }
                >
                  {off
                    ? "Desativado"
                    : expired
                      ? "Vencido"
                      : ending
                        ? "Vence em menos de 30 dias"
                        : "Ativo"}
                </Badge>
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
