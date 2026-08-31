import Link from "next/link";
import { notFound } from "next/navigation";
import { ATTRIBUTION_NAMES, getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import {
  dayOfDeadline,
  deadlineDate,
  effectiveDeadline,
  readDeadline,
} from "@/core/request/deadline.ts";
import { maskCpf } from "@/core/request/form.ts";
import {
  isOpenServiceRequestStatus,
  isServiceRequestStatus,
  readExemptionDeclaredAt,
  readPhone,
  statusLabel,
  suggestedNextStatuses,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import {
  formatDate,
  toIsoDate,
  toZonedDateTimeInput,
} from "@/core/scheduling/calendar.ts";
import { linkedConversations } from "@/lib/chat.ts";
import {
  findByProtocol,
  listAttachments,
  listRequestHistory,
  listRequirementMessages,
  listRequirements,
  requestOwnAttachments,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { DeadlineBadge } from "../_components/deadline-badge.tsx";
import { StatusBadge } from "../_components/status-badge.tsx";
import { AmountSection } from "./_components/amount-section.tsx";
import { ApplicantSection } from "./_components/applicant-section.tsx";
import { AttachmentsSection } from "./_components/attachments-section.tsx";
import { DangerSection } from "./_components/danger-section.tsx";
import { DeliverySection } from "./_components/delivery-section.tsx";
import { KeySection } from "./_components/key-section.tsx";
import type { RequirementItem } from "./_components/requirements-section.tsx";
import { RequirementsSection } from "./_components/requirements-section.tsx";
import { StatusSection } from "./_components/status-section.tsx";

const HISTORY_LABELS: Record<string, string> = {
  "service-request.create": "registrou o pedido",
  "service-request.status": "mudou o andamento",
  "service-request.deadline": "ajustou o prazo",
  "service-request.requirement.register": "registrou uma exigência",
  "service-request.requirement.fulfill": "cumpriu uma exigência",
  "service-request.amount": "informou o valor do pedido",
  "service-request.key-reissue": "emitiu uma nova chave de acesso",
  "service-request.edit": "corrigiu os dados do pedido",
  "service-request.question": "enviou uma pergunta",
  "service-request.question.reply": "respondeu uma pergunta do cidadão",
  "service-request.print.requerimento": "imprimiu o requerimento",
  "service-request.print.comprovante": "imprimiu o comprovante de acesso",
};

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * How far into the term the request is. On the day it was filed nothing has
 * run yet, and "dia 0 de 20" reads like an off-by-one to the operator rather
 * than like the counting the law prescribes.
 */
function deadlineProgress(
  deadline: { startedOn: string; days: number },
  todayIso: string,
): string {
  const day = dayOfDeadline(deadline.startedOn, todayIso);
  return day === 0
    ? `${deadline.days} dias úteis, a contar do próximo`
    : `dia ${day} de ${deadline.days}`;
}

function formatDayMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ protocolo: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "requests.manage")) notFound();

  const tenant = await getTenant();
  const { protocolo } = await params;
  const request = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!request || request.kind !== "service-request") notFound();

  const act = request.actId
    ? getActForTenant(tenant, request.actId)
    : undefined;
  const status = isServiceRequestStatus(request.status)
    ? request.status
    : "new";

  const [attachments, requirementRows, history, conversations] =
    await Promise.all([
      listAttachments(tenant.slug, request.id),
      listRequirements(tenant.slug, request.id),
      listRequestHistory(tenant.slug, request.id, request.protocolNumber),
      linkedConversations(tenant.slug, request.id),
    ]);

  const row = (a: (typeof attachments)[number]) => ({
    id: a.id,
    displayName: a.displayName,
    createdAtLabel: formatDayMonthTime(a.createdAt),
    sizeBytes: a.sizeBytes,
  });
  // Everything a requirement carries is that requirement's, not the request's.
  const ownAttachments = requestOwnAttachments(attachments);
  const citizenAttachments = ownAttachments
    .filter((a) => a.kind !== "office")
    .map(row);
  const deliveredAttachments = ownAttachments
    .filter((a) => a.kind === "office")
    .map(row);

  // One read per requirement: an office raises a handful on a request, and a
  // join would fan the request's rows out per message.
  const requirementMessages = await Promise.all(
    requirementRows.map((r) => listRequirementMessages(tenant.slug, r.id)),
  );

  const requirements: RequirementItem[] = requirementRows.map((r, i) => ({
    id: r.id,
    text: r.text,
    status: r.status === "fulfilled" ? "fulfilled" : "pending",
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt,
    resolutionFileName: r.resolutionAttachmentId
      ? attachments.find((a) => a.id === r.resolutionAttachmentId)?.displayName
      : undefined,
    resolutionAttachmentId: r.resolutionAttachmentId ?? undefined,
    forms: attachments.filter((a) => a.requirementId === r.id).map(row),
    messages: requirementMessages[i].map((m) => ({
      id: m.id,
      author: m.author,
      // A deactivated operator's account loses the name but keeps the side it
      // spoke from, which is why `author` is its own column.
      authorName:
        m.author === "staff"
          ? (m.authorName ?? "Serventia")
          : (request.applicantName ?? "Cidadão"),
      body: m.body,
      createdAt: m.createdAt,
      attachments: m.attachments.map((a) => ({
        id: a.id,
        displayName: a.displayName,
      })),
    })),
  }));

  // The term in force: the one the office set on this request, or its default
  // counted from the filing date for a request nobody has touched.
  const exemptionDeclaredAt = readExemptionDeclaredAt(request.details);
  const deadline = effectiveDeadline(
    toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
    readDeadline(request.details),
    act?.legalDeadlineDays,
    tenant.requestDeadlineDays,
  );

  return (
    <>
      <AdminPageHeader title={request.protocolNumber} />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/pedidos"
            className="flex items-center gap-1.5 text-[12.5px] text-admin-muted hover:text-admin-primary"
          >
            ‹ Fila de pedidos
          </Link>
          <span className="h-[18px] w-px bg-admin-border" />
          <StatusBadge
            status={status}
            label={statusLabel("service-request", status)}
          />
          <DeadlineBadge
            open={isOpenServiceRequestStatus(status)}
            startedOn={deadline.startedOn}
            days={deadline.days}
            today={today()}
          />
          {/* Pedida, não concedida: quem confere o benefício e decide é o
              operador, e nada aqui mexe no valor. Fica na linha dos selos
              porque muda como o pedido é trabalhado desde o primeiro olhar. */}
          {exemptionDeclaredAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-warning-bg px-2.5 py-1 text-[11.5px] font-bold text-admin-warning-text">
              Gratuidade solicitada (ISENTO) · declarada em{" "}
              {formatDayMonthYear(new Date(exemptionDeclaredAt))}
            </span>
          )}
          {/*
            Only when the same fields the print route itself requires are
            present: this page already knows `kind === "service-request"`
            (guarded above), but the route also 404s a request missing
            actId/applicantName/contact, and a link that always 404s is worse
            than no link.
          */}
          {request.actId && request.applicantName && request.contact && (
            <a
              href={`/admin/pedidos/${encodeURIComponent(request.protocolNumber)}/imprimir`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[12.5px] font-semibold text-admin-primary hover:underline"
            >
              Imprimir requerimento
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-4.5">
            <StatusSection
              requestId={request.id}
              status={status}
              subtitle={`${act?.name ?? "Ato não identificado"} · ${
                request.applicantName ?? "Solicitante não identificado"
              } · pedido em ${formatDayMonthYear(request.createdAt)}`}
              suggested={suggestedNextStatuses(status)}
              deadlineSummary={
                isOpenServiceRequestStatus(status)
                  ? `até ${formatDate(
                      deadlineDate(deadline.startedOn, deadline.days),
                    )} · ${deadlineProgress(deadline, today())}`
                  : null
              }
              deadlineDays={deadline.days}
            />

            <ApplicantSection
              requestId={request.id}
              actLabel={
                act
                  ? `${act.name} · ${ATTRIBUTION_NAMES[act.attribution]}`
                  : "Ato não identificado"
              }
              cpfMasked={request.cpf ? maskCpf(request.cpf) : "Não informado"}
              filedLabel={formatDayMonthTime(request.createdAt)}
              allowsPurpose={act?.requiresPurpose ?? false}
              data={{
                applicantName: request.applicantName ?? "",
                contact: request.contact ?? "",
                phone: readPhone(request.details),
                cpf: request.cpf ?? "",
                purpose: request.purpose ?? "",
                description: request.description ?? "",
                createdAt: toZonedDateTimeInput(
                  request.createdAt,
                  OFFICE_TIME_ZONE,
                ),
              }}
            />

            <RequirementsSection
              requestId={request.id}
              requirements={requirements}
            />

            <AttachmentsSection
              requestId={request.id}
              attachments={citizenAttachments}
            />

            <DeliverySection
              requestId={request.id}
              delivered={deliveredAttachments}
            />

            <AmountSection
              requestId={request.id}
              amountLabel={
                request.amountCents != null
                  ? formatCents(request.amountCents)
                  : undefined
              }
            />
          </div>

          <div className="flex flex-col gap-4.5">
            <KeySection
              requestId={request.id}
              protocolNumber={request.protocolNumber}
              issuedLabel={formatDate(
                toIsoDate(request.createdAt, OFFICE_TIME_ZONE),
              )}
            />

            {conversations.length > 0 && (
              <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
                <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
                  Atendimentos vinculados
                </h4>
                <ul className="mt-3 flex flex-col gap-2">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        href={`/admin/atendimento/${conversation.id}`}
                        className="flex items-center justify-between gap-2 rounded-[9px] border border-admin-border bg-admin-input-bg px-3 py-2 text-[12px] hover:border-admin-primary-soft"
                      >
                        <span className="text-admin-text">
                          {conversation.attendantName ?? "Atendente"}
                        </span>
                        <span className="text-admin-faint">
                          {conversation.closedAt
                            ? formatDayMonthTime(conversation.closedAt)
                            : "Em andamento"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
              <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
                Histórico
              </h4>
              {history.length === 0 ? (
                <p className="mt-2 text-[12px] text-admin-muted">
                  Sem eventos registrados.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {history.map((entry, index) => (
                    <li
                      key={`${entry.action}-${entry.createdAt.toISOString()}-${index}`}
                      className="text-[12.5px] leading-snug text-admin-text"
                    >
                      <strong className="text-admin-primary">
                        {entry.actorName ?? "Sistema"}
                      </strong>{" "}
                      {HISTORY_LABELS[entry.action] ?? entry.action}
                      <br />
                      <span className="text-[11px] text-admin-faint">
                        {formatDayMonthTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DangerSection requestId={request.id} />
          </div>
        </div>
      </main>
    </>
  );
}
