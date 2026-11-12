import {
  monthLabel,
  previousMonth,
  previousQuarter,
  quarterLabel,
  quarterOf,
} from "@/core/security-paper/stock.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requirePaperAccess } from "../_lib/access.ts";
import { ReportForm } from "../forms.tsx";

export const metadata = { title: "Gerar ofício do papel de segurança" };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; trimestre?: string; mes?: string }>;
}) {
  await requirePaperAccess();
  const tenant = await getTenant();
  const now = today();
  const query = await searchParams;
  // The last eight quarters, the current one included; the last 12 months.
  const quarters = [];
  let q = quarterOf(now);
  for (let i = 0; i < 8; i++) {
    quarters.push({
      value: `${q.year}-${q.quarter}`,
      label: `${quarterLabel(q)}${i === 0 ? " (em curso)" : ""}`,
    });
    q = previousQuarter(q.start);
  }
  const months = [];
  let m = { start: `${now.slice(0, 7)}-01` };
  for (let i = 0; i < 12; i++) {
    const label = monthLabel(m.start);
    months.push({
      value: m.start.slice(0, 7),
      label: `${label.charAt(0).toUpperCase()}${label.slice(1)}${i === 0 ? " (em curso)" : ""}`,
    });
    m = previousMonth(m.start);
  }
  const last = previousQuarter(now);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Gerar ofício ou relatório"
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description="Três modelos, cada um para o seu fim. O documento sai com a numeração das folhas, fica guardado e pode ser assinado digitalmente ou impresso."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-4 py-7 md:px-8">
        <ReportForm
          initial={{
            kind: query.tipo ?? "prestacao",
            quarter: query.trimestre ?? `${last.year}-${last.quarter}`,
            month: query.mes ?? previousMonth(now).start.slice(0, 7),
          }}
          quarters={quarters}
          months={months}
          signers={(await getGuideSettings(tenant)).signers.map(
            ({ name, title }) => ({ name, title }),
          )}
          today={now}
        />
      </main>
    </>
  );
}
