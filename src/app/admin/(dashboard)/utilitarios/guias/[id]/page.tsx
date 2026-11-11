import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print";
import { can } from "@/core/auth/roles.ts";
import { GUIDE_KIND_INFO } from "@/core/guides/catalog.ts";
import { formatGuideNumber } from "@/core/guides/schema.ts";
import { getSession } from "@/lib/session.ts";
import { findGuide, getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { GuideForm } from "../guide-form.tsx";
import { GuideNumber } from "./guide-number.tsx";

export const metadata = { title: "Guia de transmissão de bens" };

/** One guia: its files, and the same form to correct it (same number). */
export default async function GuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emitida?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "guides.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const { id } = await params;
  const [stored, settings] = await Promise.all([
    findGuide(tenant.slug, id),
    getGuideSettings(tenant),
  ]);
  if (!stored) notFound();
  const number = formatGuideNumber(stored.year, stored.sequence);
  const base = `/admin/utilitarios/guias/${stored.id}/arquivo`;
  const issued = (await searchParams).emitida === "1";

  return (
    <>
      <AdminPageHeader title={`Guia nº ${number}`} />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-[30px] py-7">
        <BackLink
          href="/admin/utilitarios/guias"
          label="Guias de transmissão de bens"
        />
        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-[13px] font-bold text-admin-primary">
              {GUIDE_KIND_INFO[stored.guide.kind].label} · nº {number}
            </p>
            <p className="text-[12px] text-admin-muted">
              {issued
                ? "Guia emitida. Baixe, confira, assine e entregue à parte."
                : "Corrija abaixo se precisar: o número continua o mesmo."}
            </p>
          </div>
          <SignOrPrint
            pdfHref={`${base}?formato=pdf`}
            title={`Guia nº ${number}`}
          />
          <a
            href={`${base}?formato=docx`}
            className="btn btn-admin-secondary btn-md"
          >
            <AdminIcon name="file" className="h-4 w-4" /> Word (editável)
          </a>
        </section>
        <GuideNumber
          id={stored.id}
          year={stored.year}
          sequence={stored.sequence}
        />
        <GuideForm initial={stored.guide} id={stored.id} settings={settings} />
      </main>
    </>
  );
}
