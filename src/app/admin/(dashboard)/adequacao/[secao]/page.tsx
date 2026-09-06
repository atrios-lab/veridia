import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { findSection } from "@/core/compliance/sections.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Attachments } from "../_components/attachments.tsx";
import { SectionForm } from "../_components/section-form.tsx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ secao: string }>;
}) {
  const section = findSection((await params).secao);
  return { title: section ? `Seção ${section.number} · ${section.title}` : "" };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ secao: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const section = findSection((await params).secao);
  if (!section) notFound();

  const tenant = await getTenant();
  const { intake, answers } = await loadIntake(tenant);

  return (
    <>
      <AdminPageHeader
        title={`Seção ${section.number} · ${section.title}`}
        back={{ href: "/admin/adequacao", label: "Adequação ao Provimento" }}
      />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7">
        {section.id === "anexos" ? (
          <Attachments attachments={intake.attachments} />
        ) : (
          <SectionForm sectionId={section.id} answers={answers} />
        )}
      </main>
    </>
  );
}
