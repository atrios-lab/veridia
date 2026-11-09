import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  ATTACHMENT_RETENTION_DAYS,
  attachmentServable,
} from "@/core/publications/attachment-retention.ts";
import {
  noticeTypeOf,
  publicationHeadline,
  publicationSchedule,
} from "@/core/publications/notice-types.ts";
import {
  PUBLICATION_KIND_LABELS,
  type PublicationKind,
} from "@/core/publications/publication.ts";
import {
  type PublicationState,
  publicationState,
} from "@/core/publications/state.ts";
import { formatDate, officeHolidays } from "@/core/scheduling/calendar.ts";
import { NOTICE_SECTOR_META, type NoticeSector } from "@/core/tenant/gating.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import {
  getPublication,
  publicationAttachmentStatus,
  publicationHistory,
} from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ArchiveButton } from "../_components/archive-button.tsx";
import { DeleteButton } from "../_components/delete-button.tsx";

export const metadata = { title: "Publicação" };

const STATE_LABELS: Record<PublicationState, string> = {
  live: "No site",
  scheduled: "Agendada",
  archived: "Arquivada",
  draft: "Rascunho",
};

const TAB_SLUGS: Record<PublicationState, string> = {
  live: "no-site",
  scheduled: "agendadas",
  archived: "arquivadas",
  draft: "rascunhos",
};

// Formats every browser draws; HEIC and PDF open from a link instead.
const INLINE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The audit trail's verbs, as the office reads them.
const HISTORY_LABELS: Record<string, string> = {
  "publication.create": "Cadastrada",
  "publication.update": "Alterada",
  "publication.archive": "Arquivada manualmente",
  "publication.attachment-purge": `Arquivo apagado pela regra de ${ATTACHMENT_RETENTION_DAYS} dias`,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] text-admin-text">{children}</dd>
    </div>
  );
}

/**
 * One publication, whatever its state, as the office needs to see it when
 * someone asks months later which edital said what: every date, the legal
 * rule it ran under, the full text and the file it carried, with the same
 * three actions the list offers.
 */
export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();

  const { id } = await params;
  const tenant = await getTenant();
  const row = await getPublication(tenant.slug, id);
  if (!row) notFound();

  const day = today();
  const file = publicationAttachmentStatus(row, day);
  const history = await publicationHistory(tenant.slug, row.id);
  const createdBy = history.find(
    (entry) => entry.action === "publication.create",
  )?.actorName;
  const state = publicationState(row, day);
  const headline = publicationHeadline(row, day, officeHolidays(tenant));
  const type = noticeTypeOf(row.noticeType);
  const schedule = publicationSchedule(row, officeHolidays(tenant));
  const tab = TAB_SLUGS[state];
  const fileHref = `/admin/publicacoes/${row.id}/arquivo`;
  const isImage =
    row.attachmentMimeType !== null &&
    INLINE_IMAGE_TYPES.includes(row.attachmentMimeType);

  const archivedHow = row.archivedAt
    ? `Arquivada manualmente em ${formatOfficeDateTime(row.archivedAt)}`
    : state === "archived" && row.expireAt
      ? `Saiu do site sozinha depois de ${formatDate(row.expireAt)}`
      : null;

  return (
    <>
      <AdminPageHeader
        title={row.title}
        back={{ href: `/admin/publicacoes?aba=${tab}`, label: "Publicações" }}
      />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-admin-warning-bg px-2.5 py-1 text-[10.5px] font-bold text-admin-warning-text">
            {headline.label}
          </span>
          <span className="rounded-full border border-admin-input-border px-2.5 py-1 text-[10.5px] font-bold text-admin-muted">
            {STATE_LABELS[state]}
          </span>
          <span className="flex-1" />
          <Link
            href={`/admin/publicacoes?aba=${tab}&editar=${row.id}`}
            className="btn btn-admin-secondary btn-sm"
          >
            Editar
          </Link>
          {state !== "archived" && (
            <ArchiveButton id={row.id} title={row.title} />
          )}
          <DeleteButton
            id={row.id}
            title={row.title}
            redirectTo={`/admin/publicacoes?aba=${tab}`}
          />
        </div>

        <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo">
              {PUBLICATION_KIND_LABELS[row.kind as PublicationKind] ?? row.kind}
            </Field>
            {row.sector && (
              <Field label="Setor">
                {NOTICE_SECTOR_META[row.sector as NoticeSector]?.name ??
                  row.sector}
              </Field>
            )}
            {type && (
              <Field label="Tipo de edital">
                {type.label}
                <span className="block text-xs text-admin-muted">
                  {type.legalBasis}
                </span>
              </Field>
            )}
            <Field
              label={
                schedule && schedule.runs.length > 1
                  ? "1ª publicação"
                  : "Data da publicação"
              }
            >
              {row.publishAt
                ? formatDate(row.publishAt)
                : "Ainda não publicada"}
            </Field>
            {schedule?.runs.slice(1).map((run) => (
              <Field key={run.number} label={`${run.number}ª publicação`}>
                {formatDate(run.date)}
              </Field>
            ))}
            {schedule && type && (
              <Field label={type.termLabel}>
                até {formatDate(schedule.termEndsOn)}
              </Field>
            )}
            <Field label="Sai do site em">
              {row.expireAt ? formatDate(row.expireAt) : "Sem data"}
            </Field>
            <Field label="Cadastrada em">
              {formatOfficeDateTime(row.createdAt)}
              {createdBy && (
                <span className="block text-xs text-admin-muted">
                  por {createdBy}
                </span>
              )}
            </Field>
            <Field label="Última alteração">
              {formatOfficeDateTime(row.updatedAt)}
            </Field>
            {archivedHow && <Field label="Arquivamento">{archivedHow}</Field>}
          </dl>
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Texto publicado
          </h2>
          <p className="mt-3 whitespace-pre-line [overflow-wrap:anywhere] text-[13.5px] leading-relaxed text-admin-text">
            {row.body}
          </p>
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Arquivo anexado
          </h2>
          {file.kind === "available" && (
            <p className="mt-2 rounded-[9px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-3 py-2 text-[12px] leading-relaxed text-admin-warning-text">
              Disponível até <strong>{formatDate(file.until)}</strong>
              {file.daysLeft > 0
                ? ` (faltam ${file.daysLeft} ${file.daysLeft === 1 ? "dia" : "dias"})`
                : " (último dia)"}
              . Depois disso o arquivo é apagado pela regra de{" "}
              {ATTACHMENT_RETENTION_DAYS} dias e ficam só as informações
              escritas. Baixe e guarde uma cópia na nuvem do cartório.
            </p>
          )}
          {file.kind === "held" && (
            <p className="mt-2 rounded-[9px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-3 py-2 text-[12px] leading-relaxed text-admin-warning-text">
              Os {ATTACHMENT_RETENTION_DAYS} dias terminaram em{" "}
              {formatDate(file.until)}, mas a publicação ainda está no site: o
              arquivo fica até ela sair e é apagado em seguida. Baixe e guarde
              uma cópia na nuvem do cartório.
            </p>
          )}
          {row.attachmentPath && attachmentServable(file) ? (
            <>
              <p className="mt-2 text-xs text-admin-muted">
                {isImage ? "Imagem" : "Documento"}
                {row.attachmentSizeBytes
                  ? `, ${formatBytes(row.attachmentSizeBytes)}`
                  : ""}
              </p>
              {isImage && (
                <a
                  href={fileHref}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 block"
                >
                  {/* biome-ignore lint/performance/noImgElement: served by
                      the panel's own route, which checks the session on
                      every request. */}
                  <img
                    src={fileHref}
                    alt={`Imagem anexada: ${row.title}`}
                    className="max-h-[32rem] w-auto max-w-full rounded-[10px] border border-admin-border"
                  />
                </a>
              )}
              <div className="mt-3 flex flex-wrap gap-2.5">
                <a
                  href={`${fileHref}?baixar=1`}
                  className="btn btn-admin-primary btn-sm"
                >
                  Baixar o arquivo
                </a>
                <a
                  href={fileHref}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-admin-secondary btn-sm"
                >
                  {isImage ? "Abrir a imagem em nova aba" : "Abrir o arquivo"}
                </a>
              </div>
            </>
          ) : row.attachmentPurgedAt || file.kind === "expired" ? (
            <p className="mt-2 text-[13px] leading-relaxed text-admin-muted">
              O arquivo foi apagado
              {row.attachmentPurgedAt
                ? ` em ${formatOfficeDateTime(row.attachmentPurgedAt)}`
                : ""}{" "}
              pela regra de {ATTACHMENT_RETENTION_DAYS} dias
              {row.attachmentMimeType
                ? ` (era ${row.attachmentMimeType === "application/pdf" ? "um PDF" : "uma imagem"}${
                    row.attachmentSizeBytes
                      ? ` de ${formatBytes(row.attachmentSizeBytes)}`
                      : ""
                  })`
                : ""}
              . As informações escritas desta publicação continuam registradas.
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-admin-muted">
              Esta publicação não tem arquivo anexado.
            </p>
          )}
        </section>

        <section className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Histórico
          </h2>
          {history.length === 0 ? (
            <p className="mt-2 text-[13px] text-admin-muted">
              Sem registros de alteração.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1.5">
              {history.map((entry) => (
                <li
                  key={`${entry.action}-${entry.at.toISOString()}`}
                  className="text-[13px] text-admin-text"
                >
                  <span className="text-admin-muted">
                    {formatOfficeDateTime(entry.at)}
                  </span>{" "}
                  · {HISTORY_LABELS[entry.action] ?? entry.action}
                  {entry.actorName
                    ? ` por ${entry.actorName}`
                    : entry.action === "publication.attachment-purge"
                      ? ", automaticamente"
                      : ""}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
