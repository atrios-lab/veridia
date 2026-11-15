import Link from "next/link";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  competenceLabel,
  deadlineOf,
  doiOf,
  formatCents,
  OPERATIONS,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { competencesWith, listTransfersWith } from "@/lib/title-transfers.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { TirarDuvida } from "../../../_components/tirar-duvida.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { requireDoi } from "../titularidade/_access.ts";
import {
  MarkDoiSentForm,
  RemoveTransferButton,
  UnmarkDoiSentButton,
} from "../titularidade/titularidade-forms.tsx";
import { doiPending } from "./_files.ts";

export const metadata = { title: "Carga da DOI" };

const BASE = "/admin/utilitarios/doi";

/** The month before `iso`'s: the one whose deadline runs now. */
function previousMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * The Carga da DOI, its own item (decision of 15/11/2026): the month's
 * acts read from the escrituras and registros, each one's declaration to
 * the Receita Federal and the month's file for the DOI-Web or the PGD.
 */
export default async function DoiPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; salvo?: string }>;
}) {
  await requireDoi();
  const tenant = await getTenant();
  const query = await searchParams;
  const on = today();
  const mes = /^\d{4}-\d{2}$/.test(query.mes ?? "")
    ? (query.mes as string)
    : previousMonth(on);
  const [stored, competences] = await Promise.all([
    listTransfersWith(db, tenant.slug, mes),
    competencesWith(db, tenant.slug),
  ]);
  const acts = stored.map((s) => ({
    ...s,
    pending: doiPending(s.transfer),
    sent: doiOf(s.transfer),
  }));
  const delivered = acts.filter((a) => a.sent.sentOn).length;
  const toDeliver = acts.filter((a) => !a.sent.sentOn);
  const ready = toDeliver.filter((a) => a.pending.length === 0).length;
  const justSaved = acts.find((a) => a.id === query.salvo);
  const deadline = deadlineOf(mes, officeHolidays(tenant));
  const late = on > deadline;
  const days = Math.round(
    (Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${on}T12:00:00Z`)) /
      86_400_000,
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Carga da DOI"
        description="A Declaração sobre Operações Imobiliárias à Receita Federal: uma por ato que transmitiu imóvel, lida da escritura ou do registro, no leiaute oficial da DOI-Web (Instrução Normativa RFB nº 2.186/2024)."
        actions={
          <Link href={`${BASE}/nova`} className={buttonVariants()}>
            Lançar escritura ou registro
          </Link>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <TirarDuvida topic="doi" />
        {justSaved && (
          <section className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-5 text-sm text-success-text">
            <p className="font-semibold">
              Ato salvo. Se a serventia entrega a DOI na hora da escritura, faça
              agora:
            </p>
            {justSaved.pending.length > 0 ? (
              <p>
                Antes, complete em Editar:{" "}
                {justSaved.pending.slice(0, 4).join("; ")}.
              </p>
            ) : (
              <>
                <p>
                  1. Baixe a DOI deste ato e importe na DOI-Web (Formato DOIWEB
                  para o JSON, Formato PGD para o DOI.TXT).
                </p>
                <span className="flex flex-wrap gap-2">
                  <a
                    href={`${BASE}/${justSaved.id}/arquivo?formato=json`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    DOI deste ato (JSON)
                  </a>
                  <a
                    href={`${BASE}/${justSaved.id}/arquivo?formato=pgd`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    DOI.TXT (PGD)
                  </a>
                </span>
                <p>
                  2. Depois de transmitir, marque como entregue: ela sai do
                  arquivo do mês. Quem entrega a cada 30 dias pode deixar para o
                  arquivo do mês.
                </p>
                {!justSaved.sent.sentOn && (
                  <MarkDoiSentForm id={justSaved.id} today={on} />
                )}
              </>
            )}
          </section>
        )}
        {query.salvo && !justSaved && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Ato salvo na DOI de {competenceLabel(mes)}.
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
              late
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : days <= 7
                  ? "border-warning/30 bg-warning-soft text-warning-text"
                  : "border-border bg-muted text-foreground"
            }`}
          >
            <p className="font-semibold">
              {late
                ? `Prazo vencido em ${br(deadline)}`
                : `Prazo: até ${br(deadline)}`}
            </p>
            <p>
              Até as 23h59 do último dia útil do mês seguinte ao do ato
              {late
                ? ""
                : days >= 0
                  ? ` (${days} dia${days === 1 ? "" : "s"})`
                  : ""}
              . Depois disso, a Receita cobra multa por atraso.
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Atos do mês", String(acts.length)],
            ["Já entregues", String(delivered)],
            ["Prontas para entregar", String(ready)],
            ["Com pendência", String(toDeliver.length - ready)],
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
            Arquivo do mês
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            Entregue do jeito da serventia: ato por ato, na hora da escritura
            (botões de cada ato), ou todas de uma vez com o arquivo do mês. Na
            DOI-Web: Importar arquivo de declarações, Formato DOIWEB para o JSON
            ou Formato PGD para o DOI.TXT. O arquivo do mês leva só as DOI
            prontas e ainda não entregues, conferidas com o esquema oficial da
            Receita; depois de transmitir, marque cada uma como entregue.
          </p>
          <span className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=json`}
              className={buttonVariants()}
            >
              JSON (DOI-Web)
            </a>
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=pgd`}
              className={buttonVariants({ variant: "outline" })}
            >
              DOI.TXT (PGD)
            </a>
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=xml`}
              className={buttonVariants({ variant: "outline" })}
            >
              XML
            </a>
          </span>
          {competences.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Meses com atos:{" "}
              {competences.slice(0, 8).map((c, i) => (
                <span key={c.competence}>
                  {i > 0 && "; "}
                  <Link
                    href={`${BASE}?mes=${c.competence}`}
                    className="underline underline-offset-2"
                  >
                    {competenceLabel(c.competence)} ({c.count})
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-card shadow-xs">
          <h2 className="border-b px-6 py-4 text-lg font-semibold text-foreground">
            DOI de {competenceLabel(mes)}
          </h2>
          {acts.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground text-justify hyphens-auto">
              Nenhum ato neste mês. Lance cada escritura ou registro que
              transmitiu imóvel; sem ato no mês, não há DOI a entregar.
            </p>
          ) : (
            <ul className="divide-y">
              {acts.map(({ id, transfer: t, pending, sent }) => (
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
                        t.service === "notas"
                          ? [
                              t.book && `Livro ${t.book}`,
                              t.page && `folhas ${t.page}`,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : t.entry,
                        t.matricula && `Matrícula ${t.matricula}`,
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
                    {pending.length > 0 ? (
                      <p className="mt-1 text-xs font-medium text-destructive">
                        Pendente para a DOI: {pending.slice(0, 4).join("; ")}
                        {pending.length > 4
                          ? ` e mais ${pending.length - 4}`
                          : ""}
                        .
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-success-text">
                        DOI pronta.
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
                    <a
                      href={`${BASE}/${id}/arquivo?formato=json`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      JSON
                    </a>
                    <a
                      href={`${BASE}/${id}/arquivo?formato=pgd`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      PGD
                    </a>
                    <a
                      href={`${BASE}/${id}/arquivo?formato=xml`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      XML
                    </a>
                    {sent.sentOn && <UnmarkDoiSentButton id={id} />}
                    <RemoveTransferButton id={id} mes={mes} back="doi" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
