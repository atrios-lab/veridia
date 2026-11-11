import Link from "next/link";
import { notFound } from "next/navigation";
import { auditActionLabel } from "@/core/audit/labels.ts";
import type { Role } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { notificationNumber } from "@/lib/audit-documents.ts";
import { findNotificationWith, listAuditWith } from "@/lib/audit-trail.ts";
import { certificatesForSignerWith } from "@/lib/signing.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../../_components/role-labels.ts";
import { auditAccess } from "../../access.ts";
import { AnswerForm, CloseForm, ResendButton, SignForm } from "./forms.tsx";

export const metadata = { title: "Notificação" };

const STATUS: Record<string, string> = {
  aberta: "Aguardando resposta",
  respondida: "Respondida",
  encerrada: "Encerrada",
};

function Paragraphs({ text }: { text: string }) {
  return (
    <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-admin-text [overflow-wrap:anywhere]">
      {text.trim()}
    </p>
  );
}

export default async function NotificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviada?: string }>;
}) {
  const access = await auditAccess();
  const { id } = await params;
  if (!access || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { tenant, session, manager } = access;
  const view = await findNotificationWith(db, tenant.slug, id);
  if (!view) notFound();
  const target = view.targetUserId === session.user.id;
  if (!manager && !target) notFound();
  const [entries, certificates] = await Promise.all([
    view.auditIds.length
      ? listAuditWith(db, { tenantSlugs: [tenant.slug], ids: view.auditIds })
      : Promise.resolve([]),
    manager && !view.signedDocumentId
      ? certificatesForSignerWith(db, tenant.slug, session.user.id).catch(
          () => [],
        )
      : Promise.resolve([]),
  ]);
  const sent = (await searchParams).enviada === "1";
  const late =
    view.status === "aberta" && view.deadlineAt.getTime() < Date.now();
  const ownFiles = view.files.filter((file) => file.side === "titular");
  const answerFiles = view.files.filter((file) => file.side === "notificado");
  const fileLink = (file: (typeof view.files)[number]) => (
    <li key={file.id}>
      <a
        href={`/admin/auditoria/arquivo/${file.id}`}
        target="_blank"
        rel="noopener"
        className="font-semibold text-admin-primary underline [overflow-wrap:anywhere]"
      >
        {file.displayName}
      </a>{" "}
      <span className="text-admin-muted">
        ({Math.max(1, Math.round(file.sizeBytes / 1024))} KB)
      </span>
    </li>
  );

  return (
    <>
      <AdminPageHeader title="Auditoria" />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7">
        <Link
          href="/admin/auditoria"
          className="text-[12.5px] text-admin-muted hover:text-admin-primary"
        >
          ‹ Auditoria
        </Link>
        {sent && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Notificação enviada para o e-mail de {view.targetName}. Ela também
            aparece na aba Auditoria do painel da pessoa.
          </p>
        )}
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-serif text-[18px] font-semibold text-admin-primary">
                Notificação nº {notificationNumber(view)}
              </h2>
              <p className="text-[13px] font-semibold text-admin-text">
                {view.subject}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${view.status === "aberta" ? (late ? "bg-admin-error-bg text-admin-error-text" : "bg-admin-warning-bg text-admin-warning-text") : "bg-admin-success-bg text-admin-success-text"}`}
            >
              {late ? "Prazo vencido" : (STATUS[view.status] ?? view.status)}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12.5px]">
            <dt className="font-semibold text-admin-muted">Notificado(a)</dt>
            <dd className="text-admin-text">
              {view.targetName} (
              {ROLE_LABELS[(view.targetRole ?? "") as Role] ?? view.targetRole})
            </dd>
            <dt className="font-semibold text-admin-muted">Enviada em</dt>
            <dd className="text-admin-text">
              {formatOfficeDateTime(view.createdAt)}
            </dd>
            <dt className="font-semibold text-admin-muted">
              Prazo para responder
            </dt>
            <dd className="text-admin-text">
              {formatOfficeDateTime(view.deadlineAt)} (24 horas)
            </dd>
            {manager && (
              <>
                <dt className="font-semibold text-admin-muted">E-mail</dt>
                <dd className="text-admin-text">
                  {view.emailedAt
                    ? `enviado em ${formatOfficeDateTime(view.emailedAt)}`
                    : "ainda não enviado"}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/admin/auditoria/notificacao/${view.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="btn btn-admin-secondary btn-sm"
            >
              {view.signedDocumentId
                ? "PDF assinado (imprimir)"
                : "Abrir PDF (imprimir)"}
            </a>
            {manager && <ResendButton id={view.id} />}
          </div>

          <h3 className="mt-5 text-[13px] font-bold text-admin-primary">
            Dos fatos
          </h3>
          <Paragraphs text={view.facts} />
          {entries.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 rounded-[10px] bg-admin-input-bg px-3.5 py-2.5 text-[12.5px] text-admin-text">
              {entries.map((entry) => (
                <li key={entry.id} className="[overflow-wrap:anywhere]">
                  {formatOfficeDateTime(entry.createdAt)} ·{" "}
                  {auditActionLabel(entry.action)}
                  {entry.targetLabel && ` · ${entry.targetLabel}`}
                </li>
              ))}
            </ul>
          )}
          {ownFiles.length > 0 && (
            <>
              <h3 className="mt-4 text-[13px] font-bold text-admin-primary">
                Provas anexadas
              </h3>
              <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px]">
                {ownFiles.map(fileLink)}
              </ul>
            </>
          )}
          <h3 className="mt-4 text-[13px] font-bold text-admin-primary">
            Da fundamentação
          </h3>
          <Paragraphs text={view.legalBasis} />
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Resposta
          </h2>
          {view.response ? (
            <>
              <p className="text-[12px] text-admin-muted">
                Enviada em{" "}
                {formatOfficeDateTime(view.respondedAt ?? view.createdAt)}
              </p>
              <Paragraphs text={view.response} />
              {answerFiles.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px]">
                  {answerFiles.map(fileLink)}
                </ul>
              )}
            </>
          ) : target && view.status === "aberta" ? (
            <AnswerForm id={view.id} />
          ) : (
            <p className="mt-1 text-[13px] text-admin-muted">
              {view.status === "aberta"
                ? "A pessoa ainda não respondeu."
                : "Encerrada sem resposta."}
            </p>
          )}
        </section>

        {(view.closedAt || manager) && (
          <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Conclusão
            </h2>
            {view.closedAt ? (
              <>
                <p className="text-[12px] text-admin-muted">
                  Encerrada em {formatOfficeDateTime(view.closedAt)}
                </p>
                {view.closingNote && <Paragraphs text={view.closingNote} />}
              </>
            ) : (
              <CloseForm id={view.id} />
            )}
          </section>
        )}

        {view.signedDocumentId && (
          <section className="rounded-[14px] border border-admin-border bg-admin-success-bg px-5 py-4">
            <h2 className="font-serif text-[17px] font-semibold text-admin-success-text">
              Assinada digitalmente
            </h2>
            <p className="mt-1 text-[13px] text-admin-text">
              O PDF da notificação foi assinado com certificado ICP-Brasil. O
              botão "PDF assinado (imprimir)" já entrega essa via.
              {manager && (
                <>
                  {" "}
                  <Link
                    href={`/admin/utilitarios/assinador/${view.signedDocumentId}`}
                    className="font-semibold text-admin-primary underline"
                  >
                    Ver no assinador (código de verificação e manifesto)
                  </Link>
                </>
              )}
            </p>
          </section>
        )}

        {manager && !view.signedDocumentId && (
          <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Assinar digitalmente
            </h2>
            {certificates.length ? (
              <SignForm
                id={view.id}
                certificates={certificates.map((c) => ({
                  id: c.id,
                  label: c.label,
                  holderName: c.holderName,
                }))}
              />
            ) : (
              <p className="mt-1 text-[13px] text-admin-muted">
                Nenhum certificado A1 liberado para você. Cadastre em{" "}
                <Link
                  href="/admin/configuracoes/certificados"
                  className="font-semibold text-admin-primary underline"
                >
                  Configurações › Certificados digitais
                </Link>
                .
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
