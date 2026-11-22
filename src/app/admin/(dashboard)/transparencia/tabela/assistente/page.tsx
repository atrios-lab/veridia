import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { FeeTableError, feeTableBaseWith } from "@/lib/custas.ts";
import { FEE_TABLE_CATEGORY } from "@/lib/fee-tables.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { listDocuments } from "@/lib/transparency.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { FeeAssistant } from "./fee-assistant.tsx";

export const metadata = { title: "Assistente da tabela de custas" };
export const maxDuration = 300;

/**
 * The assistente virtual that redoes the tabela de custas (decision of
 * 22/11/2026): from the table in force and the law or table that changes
 * it, a new table in the office's standard, to download or publish.
 */
export default async function FeeAssistantPage() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const documents = await listDocuments(tenant.slug);
  const tables = documents
    .filter(
      (d) =>
        d.category === FEE_TABLE_CATEGORY &&
        d.fileMimeType === "application/pdf",
    )
    .map((d) => ({ id: d.id, title: d.title }));

  let content: React.ReactNode;
  try {
    const base = await feeTableBaseWith(db, tenant.slug);
    const meta = base.data.meta;
    content = (
      <FeeAssistant
        base={{
          id: base.document.id,
          title: base.document.title,
          metaTitle: meta.title,
          validity: meta.validity,
          presentation: meta.presentation.join("\n\n"),
          year: meta.year || base.document.yearLabel,
          issPercent: `${(meta.issBasisPoints / 100).toLocaleString("pt-BR")}%`,
        }}
        tables={tables}
      />
    );
  } catch (error) {
    if (!(error instanceof FeeTableError)) throw error;
    content = (
      <p className="rounded-xl border border-warning/40 bg-warning-soft px-5 py-4 text-sm text-warning-text">
        {error.message} A tabela base precisa estar no padrão (capa, sumário e
        tabelas com código, discriminação e os sete valores).
      </p>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Assistente da tabela de custas"
        description="Refaz a tabela com o que a lei mudou, confere as contas e publica como vigente."
        back={{ href: "/admin/transparencia", label: "Transparência" }}
      />
      <main className="max-w-[1100px] px-4 pt-6 pb-8 md:px-8">{content}</main>
    </>
  );
}
