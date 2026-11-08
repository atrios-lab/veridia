import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  BULLETIN_STATUS_LABELS,
  type BulletinDraft,
  type BulletinStatus,
  bulletinDraftOf,
  formatMonthYear,
  isBulletinStatus,
  legacyBulletinDraftOf,
} from "@/core/transparency/bulletin.ts";
import type { SupportedState } from "@/core/transparency/rubrics.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  listBulletins,
  listDocuments,
  storedBulletinOf,
  type TransparencyBulletinRow,
} from "@/lib/transparency.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { BulletinForm } from "./_components/bulletin-form.tsx";
import { BulletinList } from "./_components/bulletin-list.tsx";
import { DocumentForm } from "./_components/document-form.tsx";
import { DocumentList } from "./_components/document-list.tsx";
import { TransparencyTabs } from "./_components/tabs.tsx";

export const metadata = { title: "Transparência" };

function latestLabel(row: TransparencyBulletinRow | undefined): string {
  if (!row) return "Nenhum boletim publicado";
  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  return `Último publicado: ${formatMonthYear(month, year)} (${BULLETIN_STATUS_LABELS[status].toLowerCase()})`;
}

/**
 * Every published month, as the form shows it, keyed "YYYY-MM". Picking a
 * month in the form brings its bulletin back to correct and republish; a row
 * in neither format is left out, so the form opens blank for it rather than
 * with zeros nobody typed.
 */
function savedDrafts(
  rows: TransparencyBulletinRow[],
  state: SupportedState,
): Record<string, BulletinDraft> {
  const drafts: Record<string, BulletinDraft> = {};
  for (const row of rows) {
    const stored = storedBulletinOf(row, state);
    if (!stored) continue;
    const status = isBulletinStatus(row.status) ? row.status : "preliminary";
    drafts[row.referenceMonth.slice(0, 7)] =
      stored.kind === "current"
        ? bulletinDraftOf(stored.figures, status)
        : legacyBulletinDraftOf(stored.figures, status);
  }
  return drafts;
}

export default async function TransparencyPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();

  const tenant = await getTenant();
  const { aba } = await searchParams;
  const tab = aba === "boletim" ? "boletim" : "documentos";

  return (
    <>
      <AdminPageHeader title="Transparência" />
      <div className="px-[30px] py-6">
        <TransparencyTabs />

        {tab === "documentos" ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
            <DocumentList documents={await listDocuments(tenant.slug)} />
            <DocumentForm />
          </div>
        ) : (
          <BulletinTab tenant={tenant} />
        )}
      </div>
    </>
  );
}

async function BulletinTab({
  tenant,
}: {
  tenant: Awaited<ReturnType<typeof getTenant>>;
}) {
  // One read serves the header line, the form and the list: most recent
  // month first, so the latest is the head of it.
  const bulletins = await listBulletins(tenant.slug);
  return (
    <div className="mt-6 space-y-5">
      <p className="text-[12.5px] text-admin-muted">
        {latestLabel(bulletins[0])}
      </p>
      <BulletinForm
        office={{
          name: tenant.name,
          subtitle: tenant.subtitle,
          legalFooter: tenant.legalFooter,
          city: tenant.location.city,
          state: tenant.location.state,
          publishPrivateFigures: tenant.publishBulletinPrivateFigures,
        }}
        currentMonth={Number(today().slice(5, 7))}
        currentYear={Number(today().slice(0, 4))}
        saved={savedDrafts(bulletins, tenant.location.state)}
      />
      <BulletinList bulletins={bulletins} />
    </div>
  );
}
