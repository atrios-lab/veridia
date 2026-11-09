import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  PRENOTATION_ATTRIBUTIONS,
  PRENOTATION_LABELS,
  prenotationCodesFor,
} from "@/core/fees/prenotation.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import {
  currentFeeTable,
  getFeeTableDocument,
  readFeeTables,
} from "@/lib/fee-tables.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { FeeTableEditor } from "./fee-table-editor.tsx";

export const metadata = { title: "Prenotação da tabela" };

/**
 * The prenotações of one fee table: read from its PDF or typed by the
 * office, always the item's total. What is saved for the table in force is
 * what the site charges when a citizen asks for the analysis of a title.
 */
export default async function FeeTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();
  const { id } = await params;

  const document = await getFeeTableDocument(tenant.slug, id);
  if (!document) notFound();
  const [saved, current] = await Promise.all([
    readFeeTables(tenant.slug).then((tables) => tables[id]),
    currentFeeTable(tenant.slug),
  ]);
  const inForce = current?.document.id === id;
  const codes = prenotationCodesFor(tenant.location.state);

  return (
    <>
      <AdminPageHeader
        title={`Prenotação · ${document.title}`}
        back={{ href: "/admin/transparencia", label: "Transparência" }}
      />
      <main className="px-[30px] py-7">
        <FeeTableEditor
          id={id}
          pdfHref={`/admin/transparencia/documento?id=${id}`}
          isPdf={document.fileMimeType === "application/pdf"}
          inForce={inForce}
          inForceTitle={current?.document.title}
          status={document.status}
          source={saved?.source}
          updatedAt={
            saved ? formatOfficeDateTime(new Date(saved.updatedAt)) : undefined
          }
          registries={PRENOTATION_ATTRIBUTIONS.map((attribution) => ({
            attribution,
            label: PRENOTATION_LABELS[attribution],
            expectedCode: codes?.[attribution],
            item: saved?.items[attribution],
          }))}
        />
      </main>
    </>
  );
}
