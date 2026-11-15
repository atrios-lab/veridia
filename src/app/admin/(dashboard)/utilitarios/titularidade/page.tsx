import Link from "next/link";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import { EXPORT_FORMATS } from "@/core/titularidade/exports.ts";
import {
  CHANNELS,
  competenceLabel,
  deadlineOf,
  formatCents,
  isChannel,
  OPERATIONS,
  transferWarnings,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  competencesWith,
  listFilingsWith,
  listTransfersWith,
} from "@/lib/title-transfers.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { requireTitularidade } from "./_access.ts";
import {
  CreateFilingButton,
  RemoveTransferButton,
} from "./titularidade-forms.tsx";

export const metadata = { title: "Titularidade à prefeitura" };

const BASE = "/admin/utilitarios/titularidade";

/** The month before `iso`'s: the one whose deadline runs now. */
function previousMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

export default async function TitularidadePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; salvo?: string }>;
}) {
  await requireTitularidade();
  const tenant = await getTenant();
  const query = await searchParams;
  const on = today();
  const mes = /^\d{4}-\d{2}$/.test(query.mes ?? "")
    ? (query.mes as string)
    : previousMonth(on);
  const [transfers, competences, filings] = await Promise.all([
    listTransfersWith(db, tenant.slug, mes),
    competencesWith(db, tenant.slug),
    listFilingsWith(db, tenant.slug),
  ]);
  const deadline = deadlineOf(mes, officeHolidays(tenant));
  const monthFilings = filings.filter((f) => f.competence === mes);
  const sent = monthFilings.find((f) => f.sentOn);
  const late = !sent && on > deadline;
  const days = Math.round(
    (Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${on}T12:00:00Z`)) /
      86_400_000,
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Titularidade à prefeitura"
        description="As escrituras e registros que mudaram o dono de um imóvel, comunicados todo mês à Secretaria Municipal de Tributação (Código Nacional de Normas, art. 184-A)."
        actions={
          <Link href={`${BASE}/nova?mes=${mes}`} className={buttonVariants()}>
            Lançar escritura ou registro
          </Link>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        {query.salvo && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Ato salvo na comunicação de {competenceLabel(mes)}.
          </output>
        )}

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs sm:flex-row sm:items-end sm:justify-between">
          <form className="flex items-end gap-2" action={BASE}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mes" className="text-sm font-medium">
                Mês dos atos
              </label>
              <Input
                id="mes"
                name="mes"
                type="month"
                defaultValue={mes}
                className="w-44"
              />
            </div>
            <button
              type="submit"
              className={buttonVariants({ variant: "outline" })}
            >
              Ver
            </button>
          </form>
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              sent
                ? "border-success/30 bg-success-soft text-success-text"
                : late
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : days <= 7
                    ? "border-warning/30 bg-warning-soft text-warning-text"
                    : "border-border bg-muted text-foreground"
            }`}
          >
            <p className="font-semibold">
              {sent
                ? `Enviado em ${br(sent.sentOn)}`
                : late
                  ? `Prazo vencido em ${br(deadline)}`
                  : `Prazo: até ${br(deadline)}`}
            </p>
            <p>
              {sent
                ? `${isChannel(sent.channel) ? CHANNELS[sent.channel] : sent.channel} · recibo ${sent.receipt}`
                : `Último dia útil do mês seguinte a ${competenceLabel(mes)}${late ? "" : days >= 0 ? ` (${days} dia${days === 1 ? "" : "s"})` : ""}.`}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Atos de {competenceLabel(mes)}
            </h2>
            <span className="flex flex-wrap gap-2">
              <Link
                href={`${BASE}/nova?mes=${mes}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Lançar ato
              </Link>
              <CreateFilingButton mes={mes} count={transfers.length} />
            </span>
          </div>
          {transfers.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground text-justify hyphens-auto">
              Nenhum ato lançado neste mês. Lance cada escritura ou registro que
              mudou o dono de um imóvel. Se não houve nenhum, gere o ofício sem
              movimento.
            </p>
          ) : (
            <ul className="divide-y">
              {transfers.map(({ id, transfer: t }) => {
                const warnings = transferWarnings(t);
                return (
                  <li
                    key={id}
                    className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-foreground">
                        {br(t.actDate)} ·{" "}
                        {OPERATIONS[t.operation] ?? "Operação não informada"}
                        {t.valueCents !== null &&
                          ` · ${formatCents(t.valueCents)}`}
                      </p>
                      <p className="text-muted-foreground break-words">
                        {[
                          t.matricula && `Matrícula ${t.matricula}`,
                          t.fiscalRegistration &&
                            `inscrição ${t.fiscalRegistration}`,
                          t.address,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-muted-foreground">
                        {t.transmitentes.map((p) => p.name).join(", ")} →{" "}
                        <span className="text-foreground">
                          {t.adquirentes.map((p) => p.name).join(", ")}
                        </span>
                      </p>
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
                      <RemoveTransferButton id={id} mes={mes} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Arquivos do mês para baixar e anexar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            A Carga CTP (Comunicação de Transações às Prefeituras) sai dos atos
            lançados. Ela segue o esquema oficial do CENSEC: o cabeçalho com o
            CNS e o mês, e as fichas da DOI, só com os atos de notas (o registro
            de imóveis comunica pelo ONR). No CENSEC: CTP › Cargas, escolha o
            mês e anexe o JSON; depois faça o fechamento do mês. Mês sem ato não
            tem arquivo: faça o fechamento negativo. O ofício em PDF e em Word
            fica na página de cada ofício gerado.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Carga CTP · CENSEC e prefeitura
              </p>
              <span className="flex flex-wrap gap-2">
                {(["ctp-xml", "ctp-json", "ctp-txt", "ctp-csv"] as const).map(
                  (f) => (
                    <a
                      key={f}
                      href={`${BASE}/arquivo?mes=${mes}&formato=${f}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                      title={EXPORT_FORMATS[f].label}
                    >
                      {f === "ctp-json"
                        ? "JSON (CENSEC)"
                        : f === "ctp-txt"
                          ? "TXT (relação)"
                          : f === "ctp-csv"
                            ? "Planilha CSV"
                            : "XML"}
                    </a>
                  ),
                )}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                DOI · Receita Federal
              </p>
              <p className="text-sm text-muted-foreground text-justify hyphens-auto">
                A DOI de cada ato fica no item próprio Carga da DOI, com os
                mesmos atos lançados aqui.
              </p>
              <span>
                <Link
                  href={`/admin/utilitarios/doi?mes=${mes}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Abrir a Carga da DOI
                </Link>
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <h2 className="border-b px-6 py-4 text-lg font-semibold text-foreground">
            Ofícios gerados
          </h2>
          {filings.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground">
              Nenhum ofício gerado ainda.
            </p>
          ) : (
            <ul className="divide-y">
              {filings.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-col gap-1 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`${BASE}/oficios/${f.id}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Ofício nº {f.number} · {competenceLabel(f.competence)} ·{" "}
                    {f.transfers.length === 0
                      ? "sem movimento"
                      : `${f.transfers.length} ato${f.transfers.length === 1 ? "" : "s"}`}
                  </Link>
                  <span
                    className={
                      f.sentOn ? "text-success-text" : "text-warning-text"
                    }
                  >
                    {f.sentOn
                      ? `Enviado em ${br(f.sentOn)}`
                      : "Envio não registrado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {competences.length > 0 && (
          <nav
            aria-label="Meses com atos"
            className="flex flex-wrap gap-2 text-sm"
          >
            {competences.map((c) => (
              <Link
                key={c.competence}
                href={`${BASE}?mes=${c.competence}`}
                aria-current={c.competence === mes ? "page" : undefined}
                className={buttonVariants({
                  variant: c.competence === mes ? "default" : "outline",
                  size: "sm",
                })}
              >
                {competenceLabel(c.competence)} ({c.count})
              </Link>
            ))}
          </nav>
        )}
      </main>
    </>
  );
}
