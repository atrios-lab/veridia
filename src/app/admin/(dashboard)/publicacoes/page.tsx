import Link from "next/link";
import { notFound } from "next/navigation";
import { BlobUploadProvider } from "@/app/(public)/_lib/attachments.tsx";
import { can } from "@/core/auth/roles.ts";
import {
  ATTACHMENT_RETENTION_DAYS,
  ATTACHMENT_WARNING_DAYS,
  type AttachmentStatus,
} from "@/core/publications/attachment-retention.ts";
import { publicationHeadline } from "@/core/publications/notice-types.ts";
import {
  type PublicationState,
  publicationState,
} from "@/core/publications/state.ts";
import {
  formatDate,
  type OfficeHolidays,
  officeHolidays,
} from "@/core/scheduling/calendar.ts";
import {
  listPublications,
  type PublicationRow,
  publicationAttachmentStatus,
  purgeExpiredAttachments,
} from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { blobUploadEnabled } from "@/lib/uploads.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ArchiveButton } from "./_components/archive-button.tsx";
import { DeleteButton } from "./_components/delete-button.tsx";
import { PublicationForm } from "./_components/publication-form.tsx";

export const metadata = { title: "Publicações" };

const TABS: { state: PublicationState; label: string; slug: string }[] = [
  { state: "live", label: "No site", slug: "no-site" },
  { state: "scheduled", label: "Agendadas", slug: "agendadas" },
  { state: "archived", label: "Arquivadas", slug: "arquivadas" },
  { state: "draft", label: "Rascunhos", slug: "rascunhos" },
];

/** One line about the file, for the list: when it goes, or that it went. */
function fileLabel(status: AttachmentStatus): string | null {
  switch (status.kind) {
    case "available":
      return status.daysLeft === 0
        ? "arquivo disponível só até hoje"
        : `arquivo disponível até ${formatDate(status.until)}`;
    case "held":
      return "arquivo mantido até a publicação sair do site";
    case "purged":
      return `arquivo apagado (regra de ${ATTACHMENT_RETENTION_DAYS} dias)`;
    default:
      return null;
  }
}

function stateOfSlug(slug: string | undefined): PublicationState {
  return TABS.find((t) => t.slug === slug)?.state ?? "live";
}

function exitLabel(
  row: PublicationRow,
  state: PublicationState,
  day: string,
  holidays: OfficeHolidays,
): string {
  if (state === "live" && row.expireAt) {
    const { termLabel, termEndsOn } = publicationHeadline(row, day, holidays);
    const term = termEndsOn
      ? `${termLabel?.toLowerCase()} até ${formatDate(termEndsOn)}; `
      : "";
    return `${term}sai automaticamente em ${formatDate(row.expireAt)}`;
  }
  if (state === "scheduled" && row.publishAt) {
    return `entra no site em ${formatDate(row.publishAt)}`;
  }
  if (state === "archived") return "arquivada";
  return "ainda não publicada";
}

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; editar?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();

  const tenant = await getTenant();
  const { aba, editar } = await searchParams;
  const activeState = stateOfSlug(aba);
  const day = today();

  // The 30-day rule is applied here, when the office opens its list: the
  // files past their time are deleted before the list is read. A failure
  // only leaves them for the next visit (the routes refuse to serve them
  // either way), never takes the screen down.
  try {
    await purgeExpiredAttachments(tenant.slug, day);
  } catch (error) {
    console.error("publicacoes.purge", error);
  }
  const all = await listPublications(tenant.slug);
  const withState = all.map((row) => ({
    row,
    state: publicationState(row, day),
    file: publicationAttachmentStatus(row, day),
  }));
  // Files about to go, in every tab: the reminder to save them to the
  // office's own cloud before the rule deletes them.
  const expiringSoon = withState.filter(
    ({ file }) =>
      file.kind === "available" && file.daysLeft <= ATTACHMENT_WARNING_DAYS,
  );
  const counts = Object.fromEntries(
    TABS.map((tab) => [
      tab.state,
      withState.filter((r) => r.state === tab.state).length,
    ]),
  );
  const visible = withState.filter((r) => r.state === activeState);
  const editing = editar ? all.find((row) => row.id === editar) : undefined;

  return (
    <>
      <AdminPageHeader title="Publicações" />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.slug}
              href={`/admin/publicacoes?aba=${tab.slug}`}
              className={
                tab.state === activeState
                  ? "rounded-full bg-admin-primary px-3.5 py-1.5 text-xs font-bold text-white"
                  : "rounded-full border border-admin-input-border px-3.5 py-1.5 text-xs font-semibold text-admin-muted"
              }
            >
              {tab.label} ({counts[tab.state] ?? 0})
            </Link>
          ))}
        </div>

        {expiringSoon.length > 0 && (
          <div className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-soft-bg px-4.5 py-3.5 text-[12.5px] leading-relaxed text-admin-warning-text">
            <strong>
              {expiringSoon.length === 1
                ? "1 arquivo será apagado"
                : `${expiringSoon.length} arquivos serão apagados`}{" "}
              nos próximos {ATTACHMENT_WARNING_DAYS} dias
            </strong>{" "}
            pela regra de {ATTACHMENT_RETENTION_DAYS} dias. Baixe e guarde na
            nuvem do cartório antes disso; as informações escritas continuam
            aqui.
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {expiringSoon.map(({ row, file }) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/publicacoes/${row.id}`}
                    className="font-semibold underline underline-offset-2"
                  >
                    {row.title}
                  </Link>
                  {file.kind === "available" &&
                    `: até ${formatDate(file.until)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          {visible.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
              Nenhuma publicação nesta aba. O formulário abaixo cria uma nova
              publicação.
            </p>
          ) : (
            visible.map(({ row, state, file }) => (
              <div
                key={row.id}
                className="flex items-start gap-3.5 border-b border-admin-border px-5 py-4 last:border-b-0"
              >
                <span className="mt-0.5 flex-none rounded-full bg-admin-warning-bg px-2.5 py-1 text-[10.5px] font-bold text-admin-warning-text">
                  {publicationHeadline(row, day, officeHolidays(tenant)).label}
                </span>
                <span className="min-w-0 flex-1">
                  {/* The title opens the publication: text, dates, legal
                      rule and file, in any tab, archived included. */}
                  <Link
                    href={`/admin/publicacoes/${row.id}`}
                    className="block truncate text-[13.5px] font-bold text-admin-text underline-offset-2 hover:text-admin-primary hover:underline"
                  >
                    {row.title}
                  </Link>
                  <span className="block text-xs text-admin-faint">
                    {exitLabel(row, state, day, officeHolidays(tenant))}
                    {fileLabel(file) && ` · ${fileLabel(file)}`}
                  </span>
                </span>
                <Link
                  href={`/admin/publicacoes/${row.id}`}
                  className="btn btn-admin-secondary btn-sm flex-none"
                >
                  Ver
                </Link>
                {/* Archived ones can be corrected too: editing never takes a
                    publication out of the archive by itself (see the spec). */}
                <Link
                  href={`/admin/publicacoes?aba=${aba ?? "no-site"}&editar=${row.id}`}
                  className="btn btn-admin-secondary btn-sm flex-none"
                >
                  Editar
                </Link>
                {state !== "archived" && (
                  <ArchiveButton id={row.id} title={row.title} />
                )}
                <DeleteButton id={row.id} title={row.title} />
              </div>
            ))
          )}
        </div>

        {/* Same switch the public site reads: in the deploy the attachment
            goes from the browser straight to the Blob store. */}
        <BlobUploadProvider
          enabled={blobUploadEnabled()}
          tenantSlug={tenant.slug}
        >
          <PublicationForm
            key={editing?.id ?? "nova"}
            tenant={tenant}
            editing={editing}
          />
        </BlobUploadProvider>
      </main>
    </>
  );
}
