import Link from "next/link";
import { notFound } from "next/navigation";
import { ATTRIBUTION_NAMES, getActForTenant } from "@/core/acts/catalog.ts";
import { can } from "@/core/auth/roles.ts";
import { maskCpf } from "@/core/request/form.ts";
import {
  isServiceRequestStatus,
  statusLabel,
  suggestedNextStatuses,
} from "@/core/request/kinds.ts";
import { formatCents } from "@/core/request/money.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { linkedConversations } from "@/lib/chat.ts";
import {
  findByProtocol,
  listAttachments,
  listRequestHistory,
  listRequirements,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { StatusBadge } from "../_components/status-badge.tsx";
import { AmountSection } from "./_components/amount-section.tsx";
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
  "service-request.requirement.register": "registrou uma exigência",
  "service-request.requirement.fulfill": "cumpriu uma exigência",
  "service-request.amount": "informou o valor do pedido",
  "service-request.key-reissue": "emitiu uma nova chave de acesso",
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <p className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text">
        {value}
      </p>
    </div>
  );
}

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  });
  const citizenAttachments = attachments
    .filter((a) => a.kind !== "office")
    .map(row);
  const deliveredAttachments = attachments
    .filter((a) => a.kind === "office")
    .map(row);

  const requirements: RequirementItem[] = requirementRows.map((r) => ({
    id: r.id,
    text: r.text,
    status: r.status === "fulfilled" ? "fulfilled" : "pending",
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt,
    resolutionFileName: r.resolutionAttachmentId
      ? attachments.find((a) => a.id === r.resolutionAttachmentId)?.displayName
      : undefined,
    resolutionAttachmentId: r.resolutionAttachmentId ?? undefined,
  }));

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
            />

            <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
              <h4 className="font-serif text-[17px] font-semibold text-admin-primary">
                Dados do solicitante
              </h4>
              <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <Field
                  label="Nome"
                  value={request.applicantName ?? "Não informado"}
                />
                <Field
                  label="CPF"
                  value={request.cpf ? maskCpf(request.cpf) : "Não informado"}
                />
                <Field
                  label="Contato"
                  value={request.contact ?? "Não informado"}
                />
                <Field
                  label="Ato"
                  value={
                    act
                      ? `${act.name} · ${ATTRIBUTION_NAMES[act.attribution]}`
                      : "Ato não identificado"
                  }
                />
              </div>
              {request.purpose && (
                <div className="mt-3.5">
                  <Field label="Finalidade" value={request.purpose} />
                </div>
              )}
              {request.description && (
                <div className="mt-3.5">
                  <Field label="Descrição" value={request.description} />
                </div>
              )}
            </div>

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
