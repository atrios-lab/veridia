import { db } from "@/db/index.ts";
import { getBookSettingsWith } from "@/lib/daily-book.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import { ImportForm } from "../forms.tsx";

export const metadata = { title: "Anexar produtividade ao Livro Diário" };

export default async function ImportPage() {
  await requireBookAccess();
  const tenant = await getTenant();
  const settings = await getBookSettingsWith(db, tenant.slug);
  return (
    <>
      <AdminPageHeader
        title="Anexar relatório de produtividade"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description="O sistema lê o relatório ato por ato e lança as receitas por especialidade. Confira e corrija antes de lançar."
      />
      <main className="flex max-w-[1100px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <ImportForm specialties={settings.specialties.map((s) => s.name)} />
      </main>
    </>
  );
}
