import Link from "next/link";
import { db } from "@/db/index.ts";
import { getBookSettingsWith } from "@/lib/daily-book.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { INTERIM_EXCESS_HELP } from "../../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../../_components/screen-help-button.tsx";
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
        description="As especialidades pelo código do ato, o responsável pela escrituração e, se a serventia estiver vaga, o teto do interino."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-[30px] py-7 max-md:px-4">
        <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-admin-border bg-admin-card px-4 py-3 text-[13px] text-admin-text">
          <span>
            Serventia vaga? Entenda o excedente de 90,25% do subsídio de
            ministro do STF, com exemplos:
          </span>
          <ScreenHelpButton
            help={INTERIM_EXCESS_HELP}
            canConfigure={false}
            label="O que é o excedente de 90,25% do STF, com exemplos"
          />
          <Link
            href="/admin/utilitarios/livro-diario/excedente"
            className="ml-auto text-[12.5px] font-semibold text-admin-primary underline"
          >
            Calculadora do excedente
          </Link>
        </div>
        <SettingsForm initial={await getBookSettingsWith(db, tenant.slug)} />
      </main>
    </>
  );
}
