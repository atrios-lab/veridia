import Link from "next/link";
import { brDate } from "@/core/daily-book/book.ts";
import { computeExcess } from "@/core/daily-book/excess-calc.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { getBookSettingsWith } from "@/lib/daily-book.ts";
import { listExcessWith } from "@/lib/daily-book-excess.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import { ExcessForm } from "./forms.tsx";

export const metadata = { title: "Excedente do interino" };

const TH =
  "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted";
const TD = "px-3 py-2.5 align-top text-[13px] text-admin-text";

export default async function ExcessPage({
  searchParams,
}: {
  searchParams: Promise<{ feito?: string; excluidos?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const query = await searchParams;
  const showRemoved = query.excluidos === "1";
  const [settings, calcs] = await Promise.all([
    getBookSettingsWith(db, tenant.slug),
    listExcessWith(db, tenant.slug, { withRemoved: showRemoved }),
  ]);
  const now = today();
  // The settings keep 90,25%; the form asks for the full pay.
  const subsidy = settings.ceilingCents
    ? Math.round((settings.ceilingCents * 10000) / 9025)
    : 0;
  const base = "/admin/utilitarios/livro-diario/excedente";
  return (
    <>
      <AdminPageHeader
        title="Excedente do interino"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description="Calculadora do que passa de 90,25% do subsídio de ministro do STF (Código Nacional de Normas, art. 194). Clique no ! para a explicação com exemplos."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-[30px] py-7 max-md:px-4">
        {query.feito === "excluido" && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Cálculo excluído. Ele continua guardado.
          </p>
        )}
        <ExcessForm
          initial={{
            period: settings.interimPeriod,
            start: `${now.slice(0, 7)}-01`,
            subsidy: subsidy ? formatMoneyBRL(subsidy) : "",
            revenue: "",
            expenses: "",
            notes: "",
          }}
        />
        <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-5 py-3.5">
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
              Cálculos salvos
            </h2>
            <Link
              href={`${base}${showRemoved ? "" : "?excluidos=1"}`}
              className="text-[12.5px] font-semibold text-admin-primary underline"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {calcs.length === 0 ? (
            <p className="px-5 py-4 text-[13px] text-admin-muted">
              Nenhum cálculo salvo. Faça a conta acima e clique em salvar para
              ter o PDF.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-admin-border bg-admin-input-bg">
                  <tr>
                    <th className={TH}>Período</th>
                    <th className={`${TH} text-right`}>Renda líquida</th>
                    <th className={`${TH} text-right`}>Excedente</th>
                    <th className={TH}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calcs.map((c) => {
                    const r = computeExcess(c);
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-admin-border last:border-0 ${c.removedAt ? "opacity-55" : ""}`}
                      >
                        <td className={TD}>
                          <span className={c.removedAt ? "line-through" : ""}>
                            {brDate(c.start)} a {brDate(c.end)}
                          </span>
                          {c.removedAt && (
                            <span className="block text-[12px] text-admin-muted">
                              Excluído: {c.removeReason}
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-right`}>
                          {r.netCents < 0 ? "-" : ""}R${" "}
                          {formatMoneyBRL(Math.abs(r.netCents))}
                        </td>
                        <td className={`${TD} text-right font-semibold`}>
                          R$ {formatMoneyBRL(r.excessCents)}
                        </td>
                        <td className={`${TD} text-right`}>
                          {!c.removedAt && (
                            <Link
                              href={`${base}/${c.id}`}
                              className="btn btn-admin-secondary btn-sm"
                            >
                              Abrir, assinar ou editar
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
