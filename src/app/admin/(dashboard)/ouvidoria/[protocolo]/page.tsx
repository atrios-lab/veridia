import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { manifestationLabel } from "@/core/request/channels.ts";
import { parseDetails, statusLabel } from "@/core/request/kinds.ts";
import { findByProtocol, listRecordHistory } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import {
  identificationLabel,
  ManifestationStatusBadge,
} from "../_components/status-badge.tsx";
import { InternalNoteSection } from "./_components/internal-note-section.tsx";
import { ReplySection } from "./_components/reply-section.tsx";

export const metadata = { title: "Manifestação" };

const HISTORY_LABELS: Record<string, string> = {
  "ombudsman.create": "registrou a manifestação",
  "ombudsman.respond": "respondeu ao cidadão",
  "ombudsman.draft": "salvou um rascunho de resposta",
  "ombudsman.internal-note": "salvou uma anotação interna",
};

function formatDayMonthTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function OmbudsmanDetailPage({
  params,
}: {
  params: Promise<{ protocolo: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();

  const tenant = await getTenant();
  const { protocolo } = await params;
  const record = await findByProtocol(
    tenant.slug,
    decodeURIComponent(protocolo),
  );
  if (!record || record.kind !== "ombudsman") notFound();

  const details = parseDetails("ombudsman", record.details);
  const hasContact = Boolean(record.applicantName || record.contact);
  const identified = identificationLabel({
    applicantName: record.applicantName,
    contact: record.contact,
    confidential: details.confidential,
  });

  const history = await listRecordHistory(
    tenant.slug,
    "ombudsman",
    record.id,
    record.protocolNumber,
  );

  return (
    <>
      <AdminPageHeader title={record.protocolNumber} />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/ouvidoria"
            className="flex items-center gap-1.5 text-[12.5px] text-admin-muted hover:text-admin-primary"
          >
            ‹ Ouvidoria
          </Link>
          <span className="h-[18px] w-px bg-admin-border" />
          <ManifestationStatusBadge
            status={record.status}
            label={statusLabel("ombudsman", record.status)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-4.5">
            <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
              <p className="text-[12px] text-admin-faint">
                {manifestationLabel(details.manifestationType)} ·{" "}
                {formatDayMonthTime(record.createdAt)} · {identified}
              </p>

              <div className="mt-3.5 rounded-[11px] border border-admin-border bg-admin-input-bg px-4 py-3.5">
                <p className="text-[13.5px] leading-relaxed text-admin-text">
                  {record.description}
                </p>
              </div>

              {hasContact && (
                <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {record.applicantName && (
                    <div>
                      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
                        Nome
                      </span>
                      <p className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text">
                        {record.applicantName}
                      </p>
                    </div>
                  )}
                  {record.contact && (
                    <div>
                      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
                        Contato para resposta
                      </span>
                      <p className="rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text">
                        {record.contact}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {record.status === "answered" || record.status === "done" ? (
                <div className="mt-5 border-t border-admin-border pt-4.5">
                  <span className="text-[13px] font-bold text-admin-primary">
                    Resposta enviada
                  </span>
                  <p className="mt-2 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-3 text-[13.5px] text-admin-text">
                    {record.officeReply}
                  </p>
                </div>
              ) : hasContact ? (
                <ReplySection
                  requestId={record.id}
                  initialDraft={details.draftReply ?? ""}
                />
              ) : (
                <InternalNoteSection
                  requestId={record.id}
                  initialNote={details.internalNote ?? ""}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4.5">
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
