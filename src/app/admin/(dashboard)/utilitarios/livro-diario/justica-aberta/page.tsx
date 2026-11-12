import Link from "next/link";
import { brDate, monthLabel } from "@/core/daily-book/book.ts";
import { fifteenthOrNextBusinessDay } from "@/core/daily-book/deadlines.ts";
import {
  parseSemester,
  type SemesterId,
  semesterToFill,
  shiftSemester,
} from "@/core/daily-book/justica-aberta.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import { db } from "@/db/index.ts";
import { justicaAbertaWith } from "@/lib/daily-book-justica-aberta.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireBookAccess } from "../_lib/access.ts";
import {
  CopyField,
  EditFcrcpn,
  FcrcpnForm,
  NoFcrcpnButton,
  RemoveFcrcpnButton,
} from "./forms.tsx";

export const metadata = { title: "Justiça Aberta" };

const brl = (c: number) => formatMoneyBRL(c);
const money = (c: number) => `R$ ${brl(c)}`;
const typed = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function JusticaAbertaPage({
  searchParams,
}: {
  searchParams: Promise<{ semestre?: string }>;
}) {
  await requireBookAccess();
  const tenant = await getTenant();
  const now = today();
  const query = await searchParams;
  const semester =
    parseSemester(query.semestre ?? "") ?? parseSemester(semesterToFill(now));
  if (!semester) return null;
  const {
    figures: f,
    record,
    interim,
  } = await justicaAbertaWith(db, tenant.slug, semester);
  // Filled by the 15th of the month after the semester (Prov. 24/2012).
  const [y, h] = semester.id.split("-").map(Number) as [number, number];
  const due =
    h === 1
      ? fifteenthOrNextBusinessDay(y, 7, officeHolidays(tenant))
      : fifteenthOrNextBusinessDay(y + 1, 1, officeHolidays(tenant));
  const declaredNone = record.noneIn.includes(semester.id);
  const base = "/admin/utilitarios/livro-diario/justica-aberta";
  const link = (id: SemesterId) => `${base}?semestre=${id}`;
  const pdf = `${base}/arquivo?semestre=${semester.id}`;
  const hasRcpn = f.specialties.some((s) => s.id === "rcpn" && s.acts > 0);
  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Justiça Aberta"
        back={{
          href: "/admin/utilitarios/livro-diario",
          label: "Livro Diário Auxiliar",
        }}
        description={`Dados do semestre de ${semester.label}, na ordem do formulário "Produtividade do cartório" do CNJ, prontos para copiar. Prazo: ${brDate(due)} (Provimento CNJ nº 24/2012, art. 2º).`}
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href={link(shiftSemester(semester.id, -1))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ‹ Semestre anterior
          </Link>
          <span className="rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">
            {semester.label}
          </span>
          <Link
            href={link(shiftSemester(semester.id, 1))}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Semestre seguinte ›
          </Link>
          <span className="flex-1" />
          <SignOrPrint
            pdfHref={pdf}
            title={`Justiça Aberta, ${semester.label}`}
          />
        </nav>

        {(f.monthsWithoutRevenue.length > 0 ||
          f.unmatched.length > 0 ||
          (hasRcpn && f.fcrcpn.length === 0 && !declaredNone)) && (
          <section className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-warning-text">
            <h2 className="text-base font-semibold">Antes de lançar</h2>
            {f.monthsWithoutRevenue.length > 0 && (
              <p>
                <strong>Meses sem receita no livro:</strong>{" "}
                {f.monthsWithoutRevenue
                  .map((m) => monthLabel(`${m}-01`))
                  .join(", ")}
                . Importe os relatórios de produtividade desses meses antes de
                copiar, ou confirme que não houve atos.
              </p>
            )}
            {f.unmatched.length > 0 && (
              <p>
                <strong>
                  Especialidades do livro sem correspondência no formulário:
                </strong>{" "}
                {f.unmatched
                  .map((u) => `${u.name} (${u.acts} atos, ${money(u.cents)})`)
                  .join("; ")}
                . Em Livro › Configurar, dê a cada especialidade o nome usado
                pelo CNJ (por exemplo, "Registro de Imóveis"). Esses valores não
                entram nos campos abaixo.
              </p>
            )}
            {hasRcpn && f.fcrcpn.length === 0 && !declaredNone && (
              <p>
                <strong>Repasse do FCRCPN:</strong> informe abaixo o repasse
                recebido no semestre, ou registre que não houve.
              </p>
            )}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {f.specialties.map((s, i) => (
            <div key={s.id} className="rounded-xl border bg-card px-5 py-4">
              <h2 className="mb-1 text-base font-semibold text-foreground">
                {i + 1}. {s.label}
              </h2>
              <CopyField
                label="Atos praticados"
                value={s.acts.toLocaleString("pt-BR")}
                copy={String(s.acts)}
              />
              <CopyField
                label="Receita própria - Emolumentos"
                value={money(s.ownCents)}
                copy={typed(s.ownCents)}
              />
              <CopyField
                label="Receita terceiros - Legal"
                value={money(s.legalCents)}
                copy={typed(s.legalCents)}
              />
              <CopyField
                label="Receita terceiros - Outros"
                value={money(s.otherCents)}
                copy={typed(s.otherCents)}
              />
              <CopyField
                label="Receitas totais"
                value={money(s.totalCents)}
                copy={typed(s.totalCents)}
                strong
              />
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card px-5 py-4">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Despesas do cartório
            </h2>
            <p className="mb-1 text-xs text-muted-foreground">
              Totais do período, todas as especialidades.
            </p>
            <CopyField
              label="Despesas de funcionamento"
              value={money(f.expenses.operatingCents)}
              copy={typed(f.expenses.operatingCents)}
            />
            <CopyField
              label="Despesas legais"
              value={money(f.expenses.legalCents)}
              copy={typed(f.expenses.legalCents)}
            />
            <CopyField
              label="Outras Despesas"
              value={money(f.expenses.otherCents)}
              copy={typed(f.expenses.otherCents)}
            />
            <CopyField
              label="Despesas totais"
              value={money(f.expenses.totalCents)}
              copy={typed(f.expenses.totalCents)}
              strong
            />
          </div>
          <div className="rounded-xl border-2 border-primary bg-card px-5 py-4">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Resultado consolidado do cartório
            </h2>
            <p className="mb-1 text-xs text-muted-foreground">
              O formulário calcula sozinho. Confira se bate.
            </p>
            <CopyField
              label="Receita bruta total"
              value={money(f.grossCents)}
              copy={typed(f.grossCents)}
            />
            <CopyField
              label="(-) Despesas totais"
              value={money(f.expenses.totalCents)}
              copy={typed(f.expenses.totalCents)}
            />
            <CopyField
              label="Resultado Liquido"
              value={`${f.netCents < 0 ? "-" : ""}${money(Math.abs(f.netCents))}`}
              copy={`${f.netCents < 0 ? "-" : ""}${typed(Math.abs(f.netCents))}`}
              strong
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Repasse do FCRCPN no semestre
            </h2>
            <p className="text-sm text-muted-foreground">
              Compensação dos atos gratuitos do Registro Civil, repassada já com
              o imposto de renda retido. O valor líquido entra no Livro Diário
              como receita do Registro Civil das Pessoas Naturais, no dia em que
              o dinheiro entrou, e no formulário em "Receita terceiros -
              Outros".
            </p>
          </div>
          {f.fcrcpn.length > 0 ? (
            <ul className="flex flex-col divide-y rounded-lg border">
              {f.fcrcpn.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm"
                >
                  <span className="font-semibold text-foreground">
                    {brDate(r.receivedOn)}
                  </span>
                  <span className="text-muted-foreground">
                    {r.payer}
                    {r.competence
                      ? ` · competência ${r.competence.slice(5, 7)}/${r.competence.slice(0, 4)}`
                      : ""}
                    {r.withheldCents
                      ? ` · bruto ${money(r.receivedCents + r.withheldCents)}, IR retido ${money(r.withheldCents)}`
                      : ""}
                    {r.entryId ? " · lançado no livro" : ""}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums text-foreground">
                    {money(r.receivedCents)}
                  </span>
                  <EditFcrcpn
                    initial={{
                      id: r.id,
                      receivedOn: r.receivedOn,
                      competence: r.competence,
                      payer: r.payer,
                      received: typed(r.receivedCents),
                      withheld: r.withheldCents ? typed(r.withheldCents) : "",
                      notes: r.notes,
                    }}
                  />
                  <RemoveFcrcpnButton id={r.id} />
                </li>
              ))}
              <li className="flex justify-between px-4 py-2.5 text-sm font-semibold text-foreground">
                <span>Total do semestre</span>
                <span className="tabular-nums">{money(f.fcrcpnCents)}</span>
              </li>
            </ul>
          ) : declaredNone ? (
            <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
              Registrado: não houve repasse do FCRCPN neste semestre.
            </p>
          ) : null}
          {!declaredNone && (
            <FcrcpnForm
              initial={{
                receivedOn: semester.end < now ? semester.end : now,
                competence: "",
                payer: "",
                received: "",
                withheld: "",
                notes: "",
              }}
            />
          )}
          {f.fcrcpn.length === 0 && (
            <NoFcrcpnButton semester={semester.id} declared={declaredNone} />
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">
            Só para conferência (não vai ao formulário)
          </h2>
          <p>
            Fundos do semestre: {money(f.fundsCents)} · ISS: {money(f.issCents)}
            . Não lançados como receita no livro e declarados em "Receita
            terceiros - Legal" como R$ 0,00.
          </p>
          {interim && (
            <p>
              Depósitos do excedente do interino no semestre:{" "}
              {f.deposits.length
                ? f.deposits
                    .map((d) => `${brDate(d.date)}, ${money(d.cents)}`)
                    .join("; ")
                : "nenhum"}
              . O interino lança esses valores no Justiça Aberta, em campos
              próprios (Código Nacional de Normas, art. 194, V).
            </p>
          )}
        </section>
      </main>
    </>
  );
}
