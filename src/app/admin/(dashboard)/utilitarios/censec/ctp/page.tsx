import Link from "next/link";
import { officeHolidays } from "@/core/scheduling/calendar.ts";
import {
  competenceLabel,
  deadlineOf,
  formatCents,
  OPERATIONS,
} from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { listClosingsWith } from "@/lib/censec.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { competencesWith, listTransfersWith } from "@/lib/title-transfers.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { requireCtp } from "../../titularidade/_access.ts";
import { officeForExport } from "../../titularidade/_files.ts";
import { RemoveTransferButton } from "../../titularidade/titularidade-forms.tsx";
import { ClosingForm, RemoveClosingButton } from "../censec-forms.tsx";
import { ctpPending } from "./_ctp.ts";

export const metadata = { title: "Carga CTP" };

const BASE = "/admin/utilitarios/censec/ctp";

function previousMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * The Carga CTP inside the CENSEC's loads (decision of 15/11/2026: "a
 * carga CTP pertence à CENSEC"): monthly, the acts of notas that changed
 * the ownership of an imóvel (CNN, art. 184-A), in the CENSEC's schema,
 * and the month's single fechamento, positive or negative.
 */
export default async function CtpPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; salvo?: string; fechado?: string }>;
}) {
  await requireCtp();
  const tenant = await getTenant();
  const query = await searchParams;
  const on = today();
  const mes = /^\d{4}-\d{2}$/.test(query.mes ?? "")
    ? (query.mes as string)
    : previousMonth(on);
  const office = officeForExport(tenant);
  const [stored, competences, closings] = await Promise.all([
    listTransfersWith(db, tenant.slug, mes),
    competencesWith(db, tenant.slug),
    listClosingsWith(db, tenant.slug, `${mes}-2`),
  ]);
  const notas = stored
    .filter((s) => s.transfer.service === "notas")
    .map((s) => ({ ...s, pending: ctpPending(office, mes, s.transfer) }));
  const ri = stored.length - notas.length;
  const ready = notas.filter((a) => a.pending.length === 0).length;
  const closing = closings.find((c) => c.central === "ctp");
  const deadline = deadlineOf(mes, officeHolidays(tenant));
  const late = !closing && on > deadline;
  const days = Math.round(
    (Date.parse(`${deadline}T12:00:00Z`) - Date.parse(`${on}T12:00:00Z`)) /
      86_400_000,
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Carga CTP"
        description="A Comunicação de Transações às Prefeituras pela CENSEC: as escrituras do mês que mudaram o dono de um imóvel (Código Nacional de Normas, art. 184-A), no leiaute oficial do CENSEC, com o fechamento único do mês."
        actions={
          <span className="flex flex-wrap gap-2">
            <Link href={`${BASE}/nova`} className={buttonVariants()}>
              Lançar escritura
            </Link>
            <Link
              href="/admin/utilitarios/censec"
              className={buttonVariants({ variant: "outline" })}
            >
              Cargas quinzenais
            </Link>
          </span>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        {query.salvo && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Ato salvo na Carga CTP de {competenceLabel(mes)}.
          </output>
        )}
        {query.fechado && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Fechamento registrado.
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
              closing
                ? "border-success/30 bg-success-soft text-success-text"
                : late
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : days <= 7
                    ? "border-warning/30 bg-warning-soft text-warning-text"
                    : "border-border bg-muted text-foreground"
            }`}
          >
            <p className="font-semibold">
              {closing
                ? `Fechada em ${br(closing.sentOn)}`
                : late
                  ? `Prazo vencido em ${br(deadline)}`
                  : `Prazo: até ${br(deadline)}`}
            </p>
            <p>
              Último dia útil do mês seguinte, com um fechamento único por mês
              {late || closing
                ? ""
                : days >= 0
                  ? ` (${days} dia${days === 1 ? "" : "s"})`
                  : ""}
              .
            </p>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Escrituras do mês", String(notas.length)],
            ["Prontas para o arquivo", String(ready)],
            ["Com pendência", String(notas.length - ready)],
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
            Arquivos do mês
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            No CENSEC: CTP › Cargas, escolha o mês e anexe o JSON; depois faça o
            fechamento e registre aqui. O JSON segue o esquema oficial do CENSEC
            e leva só as escrituras prontas. Mês sem ato não tem arquivo: faça o
            fechamento negativo. O XML, a relação em TXT e a planilha servem aos
            sistemas da prefeitura que leem esses formatos.
            {ri > 0 &&
              ` Os ${ri} ato(s) do registro de imóveis deste mês não entram: o registro comunica pelo ONR.`}
          </p>
          <span className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=ctp-json`}
              className={buttonVariants()}
            >
              JSON (CENSEC)
            </a>
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=ctp-xml`}
              className={buttonVariants({ variant: "outline" })}
            >
              XML
            </a>
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=ctp-txt`}
              className={buttonVariants({ variant: "outline" })}
            >
              TXT (relação)
            </a>
            <a
              href={`${BASE}/arquivo?mes=${mes}&formato=ctp-csv`}
              className={buttonVariants({ variant: "outline" })}
            >
              Planilha CSV
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
            Escrituras de {competenceLabel(mes)}
          </h2>
          {notas.length === 0 ? (
            <p className="px-6 py-5 text-sm text-muted-foreground text-justify hyphens-auto">
              Nenhuma escritura com mudança de dono neste mês. Faça o fechamento
              negativo no CENSEC e registre abaixo.
            </p>
          ) : (
            <ul className="divide-y">
              {notas.map(({ id, transfer: t, pending }) => (
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
                        [
                          t.book && `Livro ${t.book}`,
                          t.page && `folhas ${t.page}`,
                        ]
                          .filter(Boolean)
                          .join(", "),
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
                        Pendente para a CTP: {pending.slice(0, 4).join("; ")}
                        {pending.length > 4
                          ? ` e mais ${pending.length - 4}`
                          : ""}
                        .
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-success-text">
                        Pronta para a carga.
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
                    <RemoveTransferButton id={id} mes={mes} back="ctp" />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 border-t px-6 py-4">
            {closing ? (
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-success-text">
                  Fechada em {br(closing.sentOn)}
                  {closing.acts === 0
                    ? " (negativa)"
                    : ` com ${closing.acts} ato(s)`}
                  {closing.protocol ? ` · ${closing.protocol}` : ""}
                </p>
                <RemoveClosingButton
                  id={closing.id}
                  quinzena={`${mes}-2`}
                  back="ctp"
                />
              </div>
            ) : (
              <ClosingForm
                quinzena={`${mes}-2`}
                central="ctp"
                acts={ready}
                today={on}
              />
            )}
          </div>
        </section>
      </main>
    </>
  );
}
