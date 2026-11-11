import { db } from "@/db/index.ts";
import { getBookSettingsWith } from "@/lib/daily-book.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import { SettingsForm } from "../forms.tsx";

export const metadata = { title: "Configurar o Livro Diário Auxiliar" };

export default async function BookSettingsPage() {
  await requireBookAccess();
  const tenant = await getTenant();
  return (
    <>
      <AdminPageHeader
        title="Configurar o Livro Diário Auxiliar"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description="As especialidades pelo código do ato e o responsável pela escrituração."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <SettingsForm initial={await getBookSettingsWith(db, tenant.slug)} />
      </main>
    </>
  );
}
