import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  PUBLICATION_KIND_LABELS,
  type PublicationKind,
} from "@/core/publications/publication.ts";
import {
  type PublicationState,
  publicationState,
} from "@/core/publications/state.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import { NOTICE_SECTOR_META } from "@/core/tenant/gating.ts";
import { listPublications, type PublicationRow } from "@/lib/publications.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ArchiveButton } from "./_components/archive-button.tsx";
import { PublicationForm } from "./_components/publication-form.tsx";

export const metadata = { title: "Publicações" };

const TABS: { state: PublicationState; label: string; slug: string }[] = [
  { state: "live", label: "No site", slug: "no-site" },
  { state: "scheduled", label: "Agendadas", slug: "agendadas" },
  { state: "archived", label: "Arquivadas", slug: "arquivadas" },
  { state: "draft", label: "Rascunhos", slug: "rascunhos" },
];

function stateOfSlug(slug: string | undefined): PublicationState {
  return TABS.find((t) => t.slug === slug)?.state ?? "live";
}

function exitLabel(row: PublicationRow, state: PublicationState): string {
  if (state === "live" && row.expireAt) {
    return `sai automaticamente em ${formatDate(row.expireAt)}`;
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

  const all = await listPublications(tenant.slug);
  const withState = all.map((row) => ({
    row,
    state: publicationState(row, day),
  }));
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

        <div className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          {visible.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
              Nenhuma publicação nesta aba. O formulário abaixo cria uma nova
              publicação.
            </p>
          ) : (
            visible.map(({ row, state }) => (
              <div
                key={row.id}
                className="flex items-start gap-3.5 border-b border-admin-border px-5 py-4 last:border-b-0"
              >
                <span className="mt-0.5 flex-none rounded-full bg-admin-warning-bg px-2.5 py-1 text-[10.5px] font-bold text-admin-warning-text">
                  {PUBLICATION_KIND_LABELS[row.kind as PublicationKind]}
                  {row.sector
                    ? ` · ${NOTICE_SECTOR_META[row.sector as NoticeSector].acronym}`
                    : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-admin-text">
                    {row.title}
                  </span>
                  <span className="block text-xs text-admin-faint">
                    {exitLabel(row, state)}
                  </span>
                </span>
                {state !== "archived" && (
                  <>
                    <Link
                      href={`/admin/publicacoes?aba=${aba ?? "no-site"}&editar=${row.id}`}
                      className="btn btn-admin-secondary btn-sm flex-none"
                    >
                      Editar
                    </Link>
                    <ArchiveButton id={row.id} title={row.title} />
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <PublicationForm tenant={tenant} editing={editing} />
      </main>
    </>
  );
}
