import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { dataRightOption } from "@/core/request/channels.ts";
import { parseDetails } from "@/core/request/kinds.ts";
import { toIsoDate } from "@/core/scheduling/calendar.ts";
import {
  findByProtocol,
  listAttachments,
  listRecordHistory,
} from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { DeadlineBadge } from "../_components/deadline-badge.tsx";
import { ReplySection } from "./_components/reply-section.tsx";

export const metadata = { title: "Requerimento LGPD" };

const HISTORY_LABELS: Record<string, string> = {
  "data-rights.create": "registrou o requerimento",
  "data-rights.respond": "respondeu ao titular",
  "data-rights.draft": "salvou um rascunho de resposta",
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

export default async function DataRightsDetailPage({
  params,
}: {
  params: Promise<{ protocolo: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();

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

  const [attachments, history] = await Promise.all([
    listAttachments(tenant.slug, request.id),
    listRecordHistory(
      tenant.slug,
      "data-rights",
      request.id,
      request.protocolNumber,
    ),
  ]);
  const identityAttachment = attachments.find((a) => a.kind !== "office");
  const reportAttachments = attachments.filter((a) => a.kind === "office");

  return (
    <>
      <AdminPageHeader title={request.protocolNumber} />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/lgpd"
            className="flex items-center gap-1.5 text-[12.5px] text-admin-muted hover:text-admin-primary"
          >
            ‹ Requerimentos LGPD
          </Link>
          <span className="h-[18px] w-px bg-admin-border" />
          <DeadlineBadge
            status={request.status}
            requestedOn={requestedOn}
            today={today()}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-4.5">
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
              <div className="rounded-[11px] border border-admin-border bg-admin-input-bg px-4 py-3.5">
                <span className="text-[11.5px] font-bold tracking-[0.06em] text-admin-accent uppercase">
                  Direito solicitado
                </span>
                <p className="mt-1 text-[13.5px] text-admin-text">
                  {option.label} ({option.legalName})
                </p>
              </div>
              {request.description && (
                <div className="mt-2.5 rounded-[11px] border border-admin-border bg-admin-input-bg px-4 py-3.5">
                  <span className="text-[11.5px] font-bold tracking-[0.06em] text-admin-accent uppercase">
                    Pedido descrito pela titular
                  </span>
                  <p className="mt-1 text-[13.5px] text-admin-text">
                    {request.description}
                  </p>
                </div>
              )}

              <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                <Field
                  label="Titular"
                  value={request.applicantName ?? "Não informado"}
                />
                <Field
                  label="E-mail"
                  value={request.contact ?? "Não informado"}
                />
              </div>

              {identityAttachment && (
                <div className="mt-3.5 flex items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5">
                  <span className="flex-1 text-[13px] text-admin-text">
                    {identityAttachment.displayName}
                  </span>
                  <span className="text-[11.5px] text-admin-faint">
                    anexado pela titular
                  </span>
                </div>
              )}

              {request.status === "new" ? (
                <ReplySection
                  requestId={request.id}
                  initialDraft={details.draftReply ?? ""}
                />
              ) : (
                <div className="mt-5 border-t border-admin-border pt-4.5">
                  <span className="text-[13px] font-bold text-admin-primary">
                    Resposta enviada
                  </span>
                  <p className="mt-2 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3 text-[13.5px] text-admin-text">
                    {request.officeReply}
                  </p>
                  {reportAttachments.map((a) => (
                    <p
                      key={a.id}
                      className="mt-2 text-[12.5px] font-semibold text-admin-success-text"
                    >
                      {a.displayName}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4.5">
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-4.5">
              <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
                Prazo legal
              </h4>
              <p className="mt-2 text-[12.5px] leading-relaxed text-admin-muted">
                Recebido em {formatDayMonthTime(request.createdAt)}. Resposta em
                até 15 dias (Lei 13.709/2018), a cargo de {tenant.dpo.name}.
              </p>
            </div>

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
          </div>
        </div>
      </main>
    </>
  );
}
