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
        maxWidth={900}
        title="Configurar o Livro Diário Auxiliar"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description="As especialidades pelo código do ato, o responsável pela escrituração e, se a serventia estiver vaga, o teto do interino."
      />
      <main className="flex max-w-[900px] flex-col gap-4 px-4 py-7 md:px-8">
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-4 py-3 text-sm text-foreground">
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
            className="ml-auto text-xs font-semibold text-primary underline"
          >
            Calculadora do excedente
          </Link>
        </div>
        <SettingsForm initial={await getBookSettingsWith(db, tenant.slug)} />
      </main>
    </>
  );
}
