import Link from "next/link";
import { brDate } from "@/core/daily-book/book.ts";
import { computeExcess } from "@/core/daily-book/excess-calc.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { getBookSettingsWith } from "@/lib/daily-book.ts";
import { listExcessWith } from "@/lib/daily-book-excess.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { EXCESS_CALCULATOR_HELP } from "../../../../_components/screen-help.ts";
import { ScreenHelpButton } from "../../../../_components/screen-help-button.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../_ui/table.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import { ExcessForm } from "./forms.tsx";

export const metadata = { title: "Excedente do interino" };

const TH = "px-3 text-xs font-medium text-muted-foreground";
const TD = "px-3 py-2.5 align-top whitespace-normal text-foreground";

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
        maxWidth={1000}
        title="Excedente do interino"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description="Calcula a parte da renda líquida da serventia vaga que ultrapassa 90,25% do subsídio de ministro do STF (Código Nacional de Normas, art. 194). O ! ao lado do título explica a regra, com exemplos."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        {query.feito === "excluido" && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            Cálculo excluído. Ele continua guardado.
          </p>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-primary bg-card px-5 py-4">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                Como usar a calculadora
              </h2>
              <ScreenHelpButton
                help={EXCESS_CALCULATOR_HELP}
                canConfigure={false}
                label="Como preencher a calculadora, passo a passo"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Preencha os passos 1 a 3. O passo 4 mostra, enquanto você digita,
              se há valor a depositar para o Tribunal de Justiça e quanto fica
              com o interino.
            </p>
          </div>
        </section>
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
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <h2 className="text-lg font-semibold text-foreground">
              Cálculos salvos
            </h2>
            <Link
              href={`${base}${showRemoved ? "" : "?excluidos=1"}`}
              className="text-xs font-semibold text-primary underline"
            >
              {showRemoved
                ? "Esconder os excluídos"
                : "Mostrar também os excluídos"}
            </Link>
          </div>
          {calcs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Nenhum cálculo salvo. Faça a conta acima e clique em salvar para
              ter o PDF.
            </p>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Período</TableHead>
                  <TableHead className={`${TH} text-right`}>
                    Renda líquida
                  </TableHead>
                  <TableHead className={`${TH} text-right`}>
                    Excedente
                  </TableHead>
                  <TableHead className={TH}>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calcs.map((c) => {
                  const r = computeExcess(c);
                  return (
                    <TableRow
                      key={c.id}
                      className={c.removedAt ? "opacity-55" : ""}
                    >
                      <TableCell className={TD}>
                        <span className={c.removedAt ? "line-through" : ""}>
                          {brDate(c.start)} a {brDate(c.end)}
                        </span>
                        {c.removedAt && (
                          <span className="block text-xs text-muted-foreground">
                            Excluído: {c.removeReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={`${TD} text-right tabular-nums`}>
                        {r.netCents < 0 ? "-" : ""}R${" "}
                        {formatMoneyBRL(Math.abs(r.netCents))}
                      </TableCell>
                      <TableCell
                        className={`${TD} text-right font-semibold tabular-nums`}
                      >
                        R$ {formatMoneyBRL(r.excessCents)}
                      </TableCell>
                      <TableCell className={`${TD} text-right`}>
                        {!c.removedAt && (
                          <Link
                            href={`${base}/${c.id}`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Abrir, assinar ou editar
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </>
  );
}
