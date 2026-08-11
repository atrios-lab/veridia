import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  BULLETIN_STATUS_LABELS,
  type BulletinStatus,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  latestBulletin,
  listBulletins,
  listDocuments,
} from "@/lib/transparency.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { BulletinForm } from "./_components/bulletin-form.tsx";
import { BulletinList } from "./_components/bulletin-list.tsx";
import { DocumentForm } from "./_components/document-form.tsx";
import { DocumentList } from "./_components/document-list.tsx";
import { TransparencyTabs } from "./_components/tabs.tsx";

export const metadata = { title: "Transparência" };

function latestLabel(row: Awaited<ReturnType<typeof latestBulletin>>): string {
  if (!row) return "Nenhum boletim publicado";
  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  return `Último publicado: ${formatMonthYear(month, year)} (${BULLETIN_STATUS_LABELS[status].toLowerCase()})`;
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
          <div className="mt-6 space-y-5">
            <p className="text-[12.5px] text-admin-muted">
              {latestLabel(await latestBulletin(tenant.slug))}
            </p>
            <BulletinForm
              office={{
                name: tenant.name,
                subtitle: tenant.subtitle,
                cns: tenant.cns,
                legalFooter: tenant.legalFooter,
              }}
              currentMonth={Number(today().slice(5, 7))}
              currentYear={Number(today().slice(0, 4))}
            />
            <BulletinList bulletins={await listBulletins(tenant.slug)} />
          </div>
        )}
      </div>
    </>
  );
}
