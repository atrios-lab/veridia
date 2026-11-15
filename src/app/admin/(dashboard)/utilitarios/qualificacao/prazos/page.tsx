import {
  ATTRIBUTION_ORDER,
  DEADLINE_DEFAULTS,
} from "@/core/qualificacao/prazos.ts";
import { db } from "@/db/index.ts";
import { getDeadlineSettingsWith } from "@/lib/qualificacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireQualificacao } from "../_access.ts";
import { DeadlinesForm } from "../qualificacao-forms.tsx";

export const metadata = { title: "Prazos da qualificação" };

export default async function DeadlinesPage() {
  await requireQualificacao();
  const tenant = await getTenant();
  const settings = await getDeadlineSettingsWith(db, tenant.slug);
  const rows = ATTRIBUTION_ORDER.map((attribution) => {
    const law = DEADLINE_DEFAULTS[attribution];
    const own = Object.hasOwn(settings, attribution);
    const days = own ? (settings[attribution] ?? null) : law.days;
    return {
      attribution,
      lawDays: law.days,
      lawBasis: law.basis,
      mode: !own
        ? ("lei" as const)
        : days === null
          ? ("sem" as const)
          : ("proprio" as const),
      days,
    };
  });
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Prazos da qualificação"
        description="Prazo para registrar ou devolver o título com a nota, por atribuição, em dias úteis a partir da apresentação (ou da reapresentação). A lista avisa o que vence e o que venceu. Confira a sugestão com o texto vigente da lei e a norma estadual."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href="/admin/utilitarios/qualificacao"
          label="Qualificação de títulos"
        />
        <DeadlinesForm rows={rows} />
      </main>
    </>
  );
}
