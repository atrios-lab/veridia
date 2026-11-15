import Link from "next/link";
import {
  actNames,
  actProblems,
  actTitle,
  actWarnings,
  actWhere,
  CENTRALS,
  type Central,
  censecDeadline,
  isQuinzena,
  quinzenaDays,
  quinzenaLabel,
  quinzenaOf,
  shiftQuinzena,
} from "@/core/censec/censec.ts";
import schema from "@/core/censec/censec-carga.schema.json" with {
  type: "json",
};
import { censecObject, hasTxt } from "@/core/censec/exports.ts";
import { schemaProblems } from "@/core/censec/schema.ts";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  competenceLabel,
  deadlineOf,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import {
  censecQuinzenasWith,
  listCensecActsWith,
  listClosingsWith,
} from "@/lib/censec.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { listTransfersWith } from "@/lib/title-transfers.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { TirarDuvida } from "../../../_components/tirar-duvida.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { officeForExport } from "../titularidade/_files.ts";
import { requireCensec } from "./_access.ts";
import {
  ClosingForm,
  RemoveActButton,
  RemoveClosingButton,
} from "./censec-forms.tsx";
import { ctpPending } from "./ctp/_ctp.ts";

export const metadata = { title: "Cargas da CENSEC" };

const BASE = "/admin/utilitarios/censec";
const CENTRAL_KEYS = Object.keys(CENTRALS) as Central[];

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/** The quinzena whose deadline runs now: the one before today's. */
function currentDue(on: string): string {
  return shiftQuinzena(quinzenaOf(on), -1);
}

export default async function CensecPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; salvo?: string; fechado?: string }>;
}) {
  await requireCensec();
  const tenant = await getTenant();
  const query = await searchParams;
  const on = today();
  const q = isQuinzena(query.q ?? "") ? (query.q as string) : currentDue(on);
  // The CTP is monthly: the month of the quinzena shown, its own
  // fechamento kept as the month's 2nd quinzena.
  const month = q.slice(0, 7);
  const office = officeForExport(tenant);
  const [monthActs, ctpClosings] = await Promise.all([
    listTransfersWith(db, tenant.slug, month),
    listClosingsWith(db, tenant.slug, `${month}-2`),
  ]);
  const ctpActs = monthActs.filter((s) => s.transfer.service === "notas");
  const ctpReady = ctpActs.filter(
    (s) => ctpPending(office, month, s.transfer).length === 0,
  ).length;
  const ctpClosing = ctpClosings.find((x) => x.central === "ctp");
  const ctpDeadline = deadlineOf(month, officeHolidays(tenant));
  const [stored, quinzenas, closings] = await Promise.all([
    listCensecActsWith(db, tenant.slug, q),
    censecQuinzenasWith(db, tenant.slug),
    listClosingsWith(db, tenant.slug, q),
  ]);
  const deadline = censecDeadline(q, officeHolidays(tenant));
  const days = Math.round(
    (Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${on}T12:00:00Z`)) /
      86_400_000,
  );
  const { first, last } = quinzenaDays(q);
  const acts = stored.map((s) => s.act);
  const ready = stored.filter((s) => actProblems(s.act).length === 0);
  const fileProblems = schemaProblems(
    censecObject(
      { cns: tenant.cns },
      q,
      ready.map((s) => s.act),
    ),
    schema,
  );
  const closed = (c: Central) => closings.filter((x) => x.central === c);
  const allClosed = CENTRAL_KEYS.every((c) => closed(c).length > 0);
  const late = !allClosed && on > deadline;

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Cargas da CENSEC"
        description="Os atos de cada quinzena para o CEP, o CESDI e o RCTO, lidos das escrituras, procurações, atas e testamentos anexados (Código Nacional de Normas, arts. 265 a 272)."
        actions={
          <span className="flex flex-wrap gap-2">
            <Link href={`${BASE}/anexar?q=${q}`} className={buttonVariants()}>
              Anexar documentos
            </Link>
            <Link
              href={`${BASE}/ctp?mes=${q.slice(0, 7)}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Carga CTP (mensal)
            </Link>
            <Link
              href={`${BASE}/novo?q=${q}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Lançar à mão
            </Link>
          </span>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <TirarDuvida topic="censec" />
        {query.salvo && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Ato salvo na {quinzenaLabel(q)}.
          </output>
        )}
        {query.fechado && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Fechamento registrado.
          </output>
        )}

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Quinzena</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`${BASE}?q=${shiftQuinzena(q, -1)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Quinzena anterior"
              >
                ‹
              </Link>
              <span className="text-base font-semibold text-foreground">
                {quinzenaLabel(q)}
              </span>
              <Link
                href={`${BASE}?q=${shiftQuinzena(q, 1)}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
                aria-label="Próxima quinzena"
              >
                ›
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Atos de {br(first)} a {br(last)}.
              {quinzenas.length > 0 &&
                ` Com atos: ${quinzenas
                  .slice(0, 6)
                  .map(
                    (x) =>
                      `${quinzenaLabel(x.quinzena).replace(" de ", " ")} (${x.count})`,
                  )
                  .join("; ")}.`}
            </p>
          </div>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              allClosed
                ? "border-success/30 bg-success-soft text-success-text"
                : late
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : days <= 3
                    ? "border-warning/30 bg-warning-soft text-warning-text"
                    : "border-border bg-muted text-foreground"
            }`}
          >
            <p className="font-semibold">
              {allClosed
                ? "As três centrais fechadas"
                : late
                  ? `Prazo vencido em ${br(deadline)}`
                  : `Prazo: até ${br(deadline)}`}
            </p>
            <p>
              {q.endsWith("-1")
                ? "1ª quinzena: até o dia 20 do mês"
                : "2ª quinzena: até o dia 5 do mês seguinte"}{" "}
              ou o próximo dia útil (CNN, arts. 267, 270 e 272).
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Atos lançados", String(stored.length)],
            ["Prontos para o arquivo", String(ready.length)],
            ["Com pendência", String(stored.length - ready.length)],
            [
              "Centrais fechadas",
              `${CENTRAL_KEYS.filter((c) => closed(c).length > 0).length} de 3`,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border bg-card px-4 py-3 shadow-xs"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Arquivos da quinzena
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            O JSON é o formato que o CNB/CF recomenda: um arquivo leva as três
            centrais, e a CENSEC separa sozinha. No CENSEC: Área do Cartório ›
            Carga (CEP, CESDI ou RCTO) › escolha a quinzena e o formato e anexe
            o arquivo; depois faça o fechamento. Só entram os atos sem
            pendência.
          </p>
          {stored.length - ready.length > 0 && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-text">
              {stored.length - ready.length} ato(s) com pendência ficam fora do
              arquivo até serem completados (botão Alterar em cada um).
            </p>
          )}
          {fileProblems.length > 0 && (
            <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Conferido com o esquema oficial do CENSEC:{" "}
              {fileProblems.slice(0, 3).join("; ")}
              {fileProblems.length > 3
                ? ` e mais ${fileProblems.length - 3}`
                : ""}
              .
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${BASE}/arquivo?q=${q}&formato=json`}
              className={buttonVariants()}
            >
              JSON das três centrais (recomendado)
            </a>
            <a
              href={`${BASE}/relatorio?q=${q}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Relatório da quinzena (PDF)
            </a>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {CENTRAL_KEYS.map((c) => (
              <div
                key={c}
                className="flex flex-col gap-2 rounded-lg border px-4 py-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {CENTRALS[c].short} ·{" "}
                  {acts.filter((a) => a.central === c).length} ato(s)
                </p>
                <span className="flex flex-wrap gap-2">
                  <a
                    href={`${BASE}/arquivo?q=${q}&formato=json&central=${c}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    JSON
                  </a>
                  <a
                    href={`${BASE}/arquivo?q=${q}&formato=xml&central=${c}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    XML
                  </a>
                  {hasTxt(c) && (
                    <a
                      href={`${BASE}/arquivo?q=${q}&formato=txt&central=${c}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      TXT
                    </a>
                  )}
                </span>
                {!hasTxt(c) && (
                  <p className="text-xs text-muted-foreground">
                    O CNB/CF não publica as colunas do TXT do CEP: use JSON ou
                    XML.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              CTP: Comunicação de Transações às Prefeituras
            </h2>
            <p className="text-xs text-muted-foreground">
              Mensal, CNN, art. 184-A · {competenceLabel(month)} ·{" "}
              {ctpActs.length} escritura(s) · prazo até {br(ctpDeadline)}
            </p>
          </div>
          <div className="flex flex-col gap-3 px-6 py-4 text-sm">
            {ctpActs.length === 0 ? (
              <p className="text-muted-foreground text-justify hyphens-auto">
                Nenhuma escritura com mudança de dono neste mês: faça o
                fechamento negativo no CENSEC, sem arquivo, e registre aqui.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {ctpReady} pronta(s) para o arquivo
                  {ctpActs.length - ctpReady > 0
                    ? `, ${ctpActs.length - ctpReady} com pendência`
                    : ""}
                  .
                </p>
                <span className="flex flex-wrap gap-2">
                  <a
                    href={`${BASE}/ctp/arquivo?mes=${month}&formato=ctp-json`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    JSON da CTP (CENSEC)
                  </a>
                  <Link
                    href={`${BASE}/ctp?mes=${month}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Ver e editar as escrituras
                  </Link>
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t px-6 py-4">
            {ctpClosing ? (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-success-text">
                  Fechada em {br(ctpClosing.sentOn)}
                  {ctpClosing.acts === 0
                    ? " (negativa)"
                    : ` com ${ctpClosing.acts} ato(s)`}
                  {ctpClosing.protocol ? ` · ${ctpClosing.protocol}` : ""}
                </p>
                <RemoveClosingButton
                  id={ctpClosing.id}
                  quinzena={`${month}-2`}
                  returnQ={q}
                />
              </div>
            ) : (
              <ClosingForm
                quinzena={`${month}-2`}
                central="ctp"
                acts={ctpReady}
                today={on}
                returnQ={q}
              />
            )}
          </div>
        </section>

        {CENTRAL_KEYS.map((c) => {
          const mine = stored.filter((s) => s.central === c);
          const myClosings = closed(c);
          return (
            <section key={c} className="rounded-xl border bg-card shadow-xs">
              <div className="border-b px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {CENTRALS[c].short}: {CENTRALS[c].label}
                </h2>
                <p className="text-xs text-muted-foreground">
                  CNN, {CENTRALS[c].article} · {mine.length} ato(s) na quinzena
                </p>
              </div>
              {mine.length === 0 ? (
                <p className="px-6 py-4 text-sm text-muted-foreground text-justify hyphens-auto">
                  Nenhum ato nesta quinzena. Se não houve, registre o fechamento
                  negativo depois de fazê-lo no CENSEC (sem enviar arquivo).
                </p>
              ) : (
                <ul className="divide-y">
                  {mine.map(({ id, act, sourceName }) => {
                    const problems = actProblems(act);
                    const warnings = actWarnings(act);
                    return (
                      <li
                        key={id}
                        className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold text-foreground">
                            {br(act.date) || "Sem data"} · {actTitle(act)}
                          </p>
                          <p className="text-muted-foreground break-words">
                            {[
                              actWhere(act),
                              actNames(act),
                              sourceName && `lido de ${sourceName}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {problems.length > 0 && (
                            <p className="mt-1 text-xs font-medium text-destructive">
                              Pendente: {problems.join(" ")}
                            </p>
                          )}
                          {warnings.length > 0 && (
                            <p className="mt-1 text-xs text-warning-text">
                              {warnings.join(" ")}
                            </p>
                          )}
                        </div>
                        <span className="flex flex-none flex-wrap gap-2">
                          <Link
                            href={`${BASE}/${id}/alterar`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            Editar
                          </Link>
                          <RemoveActButton id={id} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-col gap-3 border-t px-6 py-4">
                {myClosings.map((x) => (
                  <div
                    key={x.id}
                    className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-success-text">
                      Fechada em {br(x.sentOn)}
                      {x.acts === 0 ? " (negativa)" : ` com ${x.acts} ato(s)`}
                      {x.protocol ? ` · ${x.protocol}` : ""}
                    </p>
                    <RemoveClosingButton id={x.id} quinzena={q} />
                  </div>
                ))}
                {myClosings.length === 0 && (
                  <ClosingForm
                    quinzena={q}
                    central={c}
                    acts={mine.length}
                    today={on}
                  />
                )}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
