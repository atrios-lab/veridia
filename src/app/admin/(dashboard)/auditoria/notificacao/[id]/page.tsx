import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { auditActionLabel, targetInWords } from "@/core/audit/labels.ts";
import type { Role } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { notificationNumber } from "@/lib/audit-documents.ts";
import { findNotificationWith, listAuditWith } from "@/lib/audit-trail.ts";
import { certificatesForSignerWith } from "@/lib/signing.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../../_components/role-labels.ts";
import { buttonVariants } from "../../../../_ui/button.tsx";
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
    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
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
        className="font-medium text-primary underline [overflow-wrap:anywhere]"
      >
        {file.displayName}
      </a>{" "}
      <span className="text-muted-foreground">
        ({Math.max(1, Math.round(file.sizeBytes / 1024))} KB)
      </span>
    </li>
  );

  return (
    <>
      <AdminPageHeader maxWidth={900} title="Auditoria" />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <BackLink href="/admin/auditoria" label="Auditoria" />
        {sent && (
          <p className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm font-medium text-success-text">
            Notificação enviada pelo painel: {view.targetName} vê o pedido na
            aba Auditoria e um aviso em todas as telas até responder
            {view.emailedAt ? ", e recebeu também por e-mail" : ""}.
          </p>
        )}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Notificação nº {notificationNumber(view)}
              </h2>
              <p className="text-sm font-medium text-foreground">
                {view.subject}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${view.status === "aberta" ? (late ? "bg-destructive text-destructive-foreground" : "bg-warning-soft text-warning-text") : "bg-success-soft text-success-text"}`}
            >
              {late ? "Prazo vencido" : (STATUS[view.status] ?? view.status)}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="font-medium text-muted-foreground">Notificado(a)</dt>
            <dd className="text-foreground">
              {view.targetName} (
              {ROLE_LABELS[(view.targetRole ?? "") as Role] ?? view.targetRole})
            </dd>
            <dt className="font-medium text-muted-foreground">Enviada em</dt>
            <dd className="text-foreground">
              {formatOfficeDateTime(view.createdAt)}
            </dd>
            <dt className="font-medium text-muted-foreground">
              Prazo para responder
            </dt>
            <dd className="text-foreground">
              {formatOfficeDateTime(view.deadlineAt)} (24 horas)
            </dd>
            {manager && (
              <>
                <dt className="font-medium text-muted-foreground">E-mail</dt>
                <dd className="text-foreground">
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
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {view.signedDocumentId
                ? "PDF assinado (imprimir)"
                : "Abrir PDF (imprimir)"}
            </a>
            {manager && <ResendButton id={view.id} />}
          </div>

          <h3 className="mt-5 text-sm font-semibold text-foreground">
            Dos fatos
          </h3>
          <Paragraphs text={view.facts} />
          {entries.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3.5 py-2.5 text-xs text-foreground">
              {entries.map((entry) => (
                <li key={entry.id} className="[overflow-wrap:anywhere]">
                  {formatOfficeDateTime(entry.createdAt)} ·{" "}
                  {auditActionLabel(entry.action)}
                  {targetInWords(entry.targetType, entry.targetLabel) &&
                    ` · ${targetInWords(entry.targetType, entry.targetLabel)}`}
                </li>
              ))}
            </ul>
          )}
          {ownFiles.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                Provas anexadas
              </h3>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                {ownFiles.map(fileLink)}
              </ul>
            </>
          )}
          <h3 className="mt-4 text-sm font-semibold text-foreground">
            Da fundamentação
          </h3>
          <Paragraphs text={view.legalBasis} />
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Resposta</h2>
          {view.response ? (
            <>
              <p className="text-xs text-muted-foreground">
                Enviada em{" "}
                {formatOfficeDateTime(view.respondedAt ?? view.createdAt)}
              </p>
              <Paragraphs text={view.response} />
              {answerFiles.length > 0 && (
                <ul className="mt-2 flex flex-col gap-0.5 text-xs">
                  {answerFiles.map(fileLink)}
                </ul>
              )}
            </>
          ) : target && view.status === "aberta" ? (
            <AnswerForm id={view.id} />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {view.status === "aberta"
                ? "A pessoa ainda não respondeu."
                : "Encerrada sem resposta."}
            </p>
          )}
        </section>

        {(view.closedAt || manager) && (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Conclusão</h2>
            {view.closedAt ? (
              <>
                <p className="text-xs text-muted-foreground">
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
          <section className="rounded-xl border border-success/30 bg-success-soft p-6">
            <h2 className="text-lg font-semibold text-success-text">
              Assinada digitalmente
            </h2>
            <p className="mt-1 text-sm text-foreground">
              O PDF da notificação foi assinado com certificado ICP-Brasil. O
              botão "PDF assinado (imprimir)" já entrega essa via.
              {manager && (
                <>
                  {" "}
                  <Link
                    href={`/admin/utilitarios/assinador/${view.signedDocumentId}`}
                    className="font-medium text-primary underline"
                  >
                    Ver no assinador (código de verificação e manifesto)
                  </Link>
                </>
              )}
            </p>
          </section>
        )}

        {manager && !view.signedDocumentId && (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">
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
              <p className="mt-1 text-sm text-muted-foreground">
                Nenhum certificado A1 liberado para você. Cadastre em{" "}
                <Link
                  href="/admin/configuracoes/certificados"
                  className="font-medium text-primary underline"
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
