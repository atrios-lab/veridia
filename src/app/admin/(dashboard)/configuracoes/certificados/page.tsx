import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { maskHolderDocument } from "@/core/signature/policy.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
  formatOfficeTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  listCertificatesWith,
  officeSignerCandidatesWith,
} from "@/lib/signing.ts";
import { listStationsWith, recentJobsWith } from "@/lib/signing-stations.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import {
  AddCertificateForm,
  CertificateSigners,
  DisableCertificate,
} from "./certificate-forms.tsx";
import {
  CertificatePolicyForm,
  PairStation,
  ReleaseForm,
  RevokeStation,
} from "./station-forms.tsx";

export const metadata = { title: "Certificados digitais" };

const DAY = 24 * 60 * 60 * 1000;

const JOB_LABELS: Record<string, string> = {
  pendente: "Aguardando a estação",
  enviada: "Na estação",
  assinada: "Assinada",
  recusada: "Não assinada",
  expirada: "Sem resposta da estação",
};

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
  const [certificates, people, stations, jobs] = await Promise.all([
    listCertificatesWith(db, tenant.slug),
    officeSignerCandidatesWith(db, tenant.slug),
    listStationsWith(db, tenant.slug).catch(() => []),
    recentJobsWith(db, tenant.slug, 20).catch(() => []),
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

        {/* The A3 tokens shared through signing stations (decision of
            16/11/2026): the manager of the office's certificates. */}
        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Certificados A3 compartilhados (estações de assinatura)
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            O token ou cartão A3 fica plugado num computador do cartório, a
            estação. As pessoas que você autorizar assinam com ele de qualquer
            computador: a plataforma manda à estação só o resumo do documento, a
            estação assina com o token e devolve. A chave nunca sai do token e
            cada uso fica registrado. Para cada certificado, escolha se o uso é
            liberado por período ou confirmado a cada assinatura na estação. A
            assinatura vale como do titular do certificado: compartilhe só com a
            autorização dele.
          </p>
        </section>

        {stations.map((station) => (
          <section
            key={station.id}
            aria-labelledby={`estacao-${station.id}`}
            className="rounded-xl border bg-card px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  id={`estacao-${station.id}`}
                  className="text-base font-semibold text-foreground"
                >
                  {station.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {station.lastSeenAt
                    ? `Última conexão em ${formatOfficeDateTime(station.lastSeenAt)}`
                    : "Ainda não se conectou"}
                  {station.version
                    ? ` · Assinador Veridia ${station.version}`
                    : ""}
                </p>
              </div>
              <Badge
                className={
                  station.online
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                }
              >
                {station.online ? "Ligada" : "Desligada"}
              </Badge>
            </div>
            {station.certificates.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum certificado A3 plugado nesta estação agora.
              </p>
            ) : (
              station.certificates.map((certificate) => {
                const [holder] = certificate.nome.split(":");
                const until = certificate.policy.releasedUntil;
                const released =
                  until && until.getTime() > now
                    ? formatOfficeTime(until)
                    : null;
                return (
                  <div
                    key={certificate.id}
                    className="mt-3 border-t pt-3 first:border-t-0"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {holder}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emitido por {certificate.emissor} · válido até{" "}
                      {new Date(certificate.validade).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                    <CertificatePolicyForm
                      stationId={station.id}
                      certificateKey={certificate.id}
                      people={people}
                      shared={certificate.policy.shared}
                      mode={certificate.policy.mode}
                      signerIds={certificate.policy.signerIds}
                    />
                    {certificate.policy.shared &&
                      certificate.policy.mode === "periodo" && (
                        <ReleaseForm
                          stationId={station.id}
                          certificateKey={certificate.id}
                          releasedUntil={released}
                        />
                      )}
                  </div>
                );
              })
            )}
            <div className="mt-4 border-t pt-3">
              <RevokeStation stationId={station.id} />
            </div>
          </section>
        ))}

        <PairStation />

        {jobs.length > 0 && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Últimas assinaturas pelas estações
            </h2>
            <ul className="mt-2 flex flex-col divide-y text-sm">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-baseline gap-x-2 py-2"
                >
                  <span className="font-medium text-foreground">
                    {job.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {job.requestedByName} · {job.stationName} ·{" "}
                    {formatOfficeDateTime(job.createdAt)}
                  </span>
                  <span
                    className={`ml-auto text-xs font-medium ${job.status === "assinada" ? "text-success-text" : job.status === "pendente" || job.status === "enviada" ? "text-muted-foreground" : "text-warning-text"}`}
                  >
                    {JOB_LABELS[job.status] ?? job.status}
                    {job.error && job.status !== "assinada"
                      ? `: ${job.error}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
