import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { DemoHeldEmails } from "@/app/admin/_components/demo-held-emails.tsx";
import { can } from "@/core/auth/roles.ts";
import { approvalStatus } from "@/core/dpo/alinhamento.ts";
import { REQUEST_FILE_RETENTION_DAYS } from "@/core/request/attachment-retention.ts";
import {
  dataRightOption,
  dataRightsDeadlineLabel,
  dataRightsDeadlineNotice,
} from "@/core/request/channels.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import { formatOfficeDayMonthTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { alignmentMessagesWith } from "@/lib/dpo/alignment.ts";
import { filesSavedMarksWith } from "@/lib/request-files-due.ts";
import {
  findByProtocol,
  listAttachments,
  listRecordHistory,
  requestFileStatusOf,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { requestFileGoneLabel } from "../../../_components/attachment-link.ts";
import { AttachmentRow } from "../../../_components/attachment-row.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { RequestFilesNotice } from "../../../_components/request-files-notice.tsx";
import { SignOrPrint } from "../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { DeadlineBadge } from "../_components/deadline-badge.tsx";
import {
  AlignmentSection,
  ApprovalBlock,
  AttachForTitular,
} from "./_components/alignment-section.tsx";
import { ReplySection } from "./_components/reply-section.tsx";
import { deleteAttachmentAction } from "./actions.ts";

export const metadata = { title: "Requerimento LGPD" };

const HISTORY_LABELS: Record<string, string> = {
  "data-rights.create": "registrou o requerimento",
  "data-rights.respond": "respondeu ao titular",
  "data-rights.draft": "salvou um rascunho de resposta",
  "data-rights.align": "conversou com o Assistente Virtual",
  "data-rights.auto-draft":
    "preparou a resposta com o que foi alinhado na conversa",
  "data-rights.approve": "aprovou a resposta (decisão final)",
  "data-rights.attachment-purge": `apagou um arquivo, ${REQUEST_FILE_RETENTION_DAYS} dias após o encerramento`,
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
      </span>
      <p className="rounded-md border bg-muted px-3 py-2 text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}

export default async function DataRightsDetailPage({
  params,
}: {
  params: Promise<{ protocolo: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "channels.manage", session.user.permissions)
  )
    notFound();

  const tenant = await getTenant();
  const { protocolo } = await params;
  const request = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!request || request.kind !== "data-rights") notFound();

  const details = parseDetails("data-rights", request.details);
  const option = dataRightOption(details.right);
  const requestedOn = toIsoDate(request.createdAt, OFFICE_TIME_ZONE);

  const canAssist = can(
    session.user.role ?? "",
    "dpo.assist",
    session.user.permissions,
  );
  const canDecide = can(
    session.user.role ?? "",
    "lgpd.decide",
    session.user.permissions,
  );
  const [attachments, history, conversation] = await Promise.all([
    listAttachments(tenant.slug, request.id),
    listRecordHistory(
      tenant.slug,
      "data-rights",
      request.id,
      request.protocolNumber,
      session?.user.role === "superadmin",
    ),
    request.status === "new" && canAssist
      ? alignmentMessagesWith(db, tenant.slug, request.id)
      : Promise.resolve([]),
  ]);
  const approval = approvalStatus(details.approval, details.draftReply ?? "");
  const citizenAttachments = attachments.filter((a) => a.kind !== "office");
  const reportAttachments = attachments.filter((a) => a.kind === "office");
  const todayIso = today();

  const filesSaved = await filesSavedMarksWith(db, tenant.slug, [request.id]);
  return (
    <>
      <AdminPageHeader title={request.protocolNumber} />
      <main className="flex flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink href="/admin/lgpd" label="Requerimentos LGPD" />
          <span className="h-4.5 w-px bg-border" />
          <DeadlineBadge
            status={request.status}
            requestedOn={requestedOn}
            today={today()}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-6">
            <RequestFilesNotice
              files={attachments.map((a) => ({
                status: requestFileStatusOf(a, request, todayIso),
                purgedAt: a.purgedAt,
              }))}
              requestId={request.id}
              saved={filesSaved.get(request.id)}
            />
            <div className="rounded-xl border bg-card p-6">
              <div className="rounded-lg bg-muted/50 px-4 py-3.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Direito solicitado
                </span>
                <p className="mt-1 text-sm whitespace-pre-line text-foreground [overflow-wrap:anywhere]">
                  {option.label} ({option.legalName})
                </p>
              </div>
              {request.description && (
                <div className="mt-2.5 rounded-lg bg-muted/50 px-4 py-3.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pedido descrito pela titular
                  </span>
                  <p className="mt-1 text-sm whitespace-pre-line text-foreground [overflow-wrap:anywhere]">
                    {request.description}
                  </p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Titular"
                  value={request.applicantName ?? "Não informado"}
                />
                <Field
                  label="E-mail"
                  value={request.contact ?? "Não informado"}
                />
              </div>

              {citizenAttachments.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Enviados pelo titular
                  </span>
                  {citizenAttachments.map((a) => (
                    <AttachmentRow
                      key={a.id}
                      requestId={request.id}
                      attachment={{
                        id: a.id,
                        displayName: a.displayName,
                        createdAtLabel: formatOfficeDayMonthTime(a.createdAt),
                        sizeBytes: a.sizeBytes,
                        goneLabel: requestFileGoneLabel(
                          a.purgedAt,
                          requestFileStatusOf(a, request, todayIso),
                        ),
                      }}
                      meta="enviado em"
                      onDelete={deleteAttachmentAction}
                    />
                  ))}
                </div>
              )}

              {request.status === "new" && (
                <div className="mt-4 flex flex-col gap-2 rounded-lg border px-3.5 py-3">
                  <span className="text-sm font-medium text-foreground">
                    Documentos da serventia para o titular
                  </span>
                  <p className="text-xs text-muted-foreground text-justify hyphens-auto">
                    Aparecem na consulta do titular, com o protocolo e a chave.
                    Também dá para anexar junto com a resposta, ao concluir.
                  </p>
                  {reportAttachments.map((a) => (
                    <AttachmentRow
                      key={a.id}
                      requestId={request.id}
                      attachment={{
                        id: a.id,
                        displayName: a.displayName,
                        createdAtLabel: formatOfficeDayMonthTime(a.createdAt),
                        sizeBytes: a.sizeBytes,
                        goneLabel: requestFileGoneLabel(
                          a.purgedAt,
                          requestFileStatusOf(a, request, todayIso),
                        ),
                      }}
                      meta="enviado em"
                      onDelete={deleteAttachmentAction}
                    />
                  ))}
                  <AttachForTitular requestId={request.id} />
                </div>
              )}

              {request.status === "new" && canAssist && (
                <AlignmentSection
                  requestId={request.id}
                  messages={conversation.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    sources: m.sources,
                    atLabel: formatOfficeDayMonthTime(m.createdAt),
                  }))}
                />
              )}

              {(request.status === "new"
                ? Boolean(details.draftReply?.trim())
                : Boolean(request.officeReply?.trim())) && (
                <div className="mt-5 flex flex-col gap-2 rounded-lg border px-3.5 py-3">
                  <span className="text-sm font-medium text-foreground">
                    Arquivo da resposta (PDF ou Word)
                  </span>
                  <p className="text-xs text-muted-foreground text-justify hyphens-auto">
                    {request.status === "new"
                      ? 'A resposta pronta, no papel da serventia, com o texto do rascunho como foi salvo por último. Baixe em PDF ou Word, assine (digitalmente ou à mão) e anexe de volta ao titular em "Documentos da serventia para o titular" ou junto com a resposta, ao concluir.'
                      : "A resposta enviada, no papel da serventia, em PDF ou Word."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/admin/lgpd/${encodeURIComponent(request.protocolNumber)}/resposta`}
                      download={`resposta-${request.protocolNumber}.pdf`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Baixar PDF
                    </a>
                    <a
                      href={`/admin/lgpd/${encodeURIComponent(request.protocolNumber)}/resposta/word`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Baixar Word
                    </a>
                    <SignOrPrint
                      pdfHref={`/admin/lgpd/${encodeURIComponent(request.protocolNumber)}/resposta`}
                      title={`Resposta ao requerimento ${request.protocolNumber}`}
                    />
                  </div>
                </div>
              )}
              {request.status === "new" &&
                details.draftAuto &&
                details.draftReply && (
                  <p className="mt-5 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-3 text-sm text-foreground text-justify hyphens-auto">
                    O Assistente Virtual preparou a resposta com o que foi
                    alinhado na conversa. Revise com atenção e ajuste ao caso
                    antes de pedir a aprovação.
                  </p>
                )}
              {request.status === "new" && (
                <ApprovalBlock
                  requestId={request.id}
                  status={approval}
                  approvedBy={
                    details.approval
                      ? `${details.approval.byName} em ${formatOfficeDayMonthTime(new Date(details.approval.at))}`
                      : null
                  }
                  canDecide={canDecide}
                  hasDraft={Boolean(details.draftReply?.trim())}
                />
              )}
              {request.status === "new" ? (
                <ReplySection
                  requestId={request.id}
                  initialDraft={details.draftReply ?? ""}
                  canDraft={canAssist}
                />
              ) : (
                <div className="mt-5 border-t pt-4">
                  <span className="text-sm font-medium text-foreground">
                    Resposta enviada
                  </span>
                  <p className="mt-2 rounded-lg bg-muted/50 px-3.5 py-3 text-sm text-foreground">
                    {request.officeReply}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {reportAttachments.map((a) => (
                      <AttachmentRow
                        key={a.id}
                        requestId={request.id}
                        attachment={{
                          id: a.id,
                          displayName: a.displayName,
                          createdAtLabel: formatOfficeDayMonthTime(a.createdAt),
                          sizeBytes: a.sizeBytes,
                          goneLabel: requestFileGoneLabel(
                            a.purgedAt,
                            requestFileStatusOf(a, request, todayIso),
                          ),
                        }}
                        meta="entregue em"
                        onDelete={deleteAttachmentAction}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border bg-card p-4">
              <h4 className="text-base font-semibold text-foreground">
                {dataRightsDeadlineLabel(details.right)}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Recebido em {formatOfficeDayMonthTime(request.createdAt)}.{" "}
                {dataRightsDeadlineNotice(details.right)} A resposta fica a
                cargo de {tenant.dpo.name}.
              </p>
            </div>

            <DemoHeldEmails
              tenant={tenant}
              related={{ kind: "request", protocol: request.protocolNumber }}
            />

            <div className="rounded-xl border bg-card p-4">
              <h4 className="text-base font-semibold text-foreground">
                Histórico
              </h4>
              {history.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sem eventos registrados.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {history.map((entry, index) => (
                    <li
                      key={`${entry.action}-${entry.createdAt.toISOString()}-${index}`}
                      className="text-xs leading-snug text-foreground"
                    >
                      <strong className="font-semibold text-foreground">
                        {entry.action.endsWith(".attachment-purge")
                          ? "Plataforma"
                          : (entry.actorName ?? "Sistema")}
                      </strong>{" "}
                      {HISTORY_LABELS[entry.action] ?? entry.action}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {formatOfficeDayMonthTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
