import { Plus } from "lucide-react";
import Link from "next/link";
import { brDate } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";
import { dueOf, statusText } from "./_shared.ts";

export const metadata = { title: "Protocolo (Livro 1)" };

const VIEWS = [
  ["abertos", "Em andamento"],
  ["todos", "Todos"],
  ["exame", "Exame e cálculo"],
  ["apagados", "Apagados"],
] as const;

/**
 * The Livro 1: every título in the order it came in (Lei nº 6.015/1973,
 * arts. 174, 175 and 182), with the prazos that run in dias úteis.
 */
export default async function ProtocolListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, tenant } = await requireRi();
  const params = await searchParams;
  const view = VIEWS.find(([v]) => v === params.ver)?.[0] ?? "abertos";
  const q = (params.q ?? "").trim().toLowerCase();
  const today = officeToday();
  const all = await listProtocolsWith(db, tenant.slug, {
    voided: view === "apagados",
  });
  const counters = countersOf(all, today);
  const rows = all
    .filter((r) =>
      view === "exame"
        ? r.kind === "exame"
        : view === "abertos"
          ? r.kind === "prenotacao" &&
            ["prenotado", "exigencia", "duvida"].includes(r.status)
          : true,
    )
    .filter(
      (r) =>
        !q ||
        [r.number, r.presenterName, r.presenterDocument, r.titleKind]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  return (
    <RiPage
      wide
      title="Protocolo (Livro 1)"
      description="Todo título apresentado ganha o número de ordem, que fixa a prioridade (Lei nº 6.015/1973, arts. 174, 182 e 186). A qualificação vence em 10 dias úteis (5 nos casos do art. 188, § 1º) e a prenotação em 20 (art. 205), contados em dias úteis (art. 9º, § 1º)."
      actions={
        <>
          <Link
            href="/admin/ri/protocolo/dias"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Encerramento dos dias
          </Link>
          {riCan(session, "ri.edit") && (
            <Link
              href="/admin/ri/protocolo/novo"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" /> Novo protocolo
            </Link>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Em andamento", counters.open, ""],
          ["Qualificação vencida", counters.qualifyLate, "text-destructive"],
          [
            "Qualificação vence hoje",
            counters.qualifyToday,
            "text-warning-text",
          ],
          [
            "Prenotação no fim (em exigência)",
            counters.prenotationEnding,
            "text-warning-text",
          ],
        ].map(([label, value, tone]) => (
          <div
            key={label as string}
            className="rounded-xl border bg-card px-4 py-3 shadow-xs"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map(([v, label]) => (
            <Link
              key={v}
              href={`/admin/ri/protocolo?ver=${v}`}
              className={buttonVariants({
                size: "sm",
                variant: v === view ? "default" : "outline",
              })}
            >
              {label}
            </Link>
          ))}
        </div>
        <input type="hidden" name="ver" value={view} />
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-medium">
          Buscar
          <input
            name="q"
            defaultValue={q}
            placeholder="Número, apresentante, CPF, natureza…"
            className="h-9 rounded-md border bg-background px-2.5 text-sm font-normal"
          />
        </label>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Buscar
        </button>
      </form>

      {rows.length === 0 ? (
        <Panel title="Nenhum protocolo aqui">
          <p className="text-sm text-muted-foreground">
            Lance o título no balcão em Novo protocolo.
          </p>
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nº</th>
                <th className="px-3 py-2 font-medium">Apresentação</th>
                <th className="px-3 py-2 font-medium">Apresentante e título</th>
                <th className="px-3 py-2 font-medium">Qualificar até</th>
                <th className="px-3 py-2 font-medium">Prenotação até</th>
                <th className="px-3 py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const open = ["prenotado", "exigencia", "duvida"].includes(
                  r.status,
                );
                const qualify =
                  open && r.status === "prenotado"
                    ? dueOf(r.qualifyBy, today)
                    : null;
                const ends = open ? dueOf(r.prenotationEnds, today) : null;
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/ri/protocolo/${r.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {r.kind === "exame" ? "E-" : ""}
                        {r.number.toLocaleString("pt-BR")}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {brDate(r.presentedOn)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium">
                        {r.presenterName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.titleKind}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {qualify ? (
                        <span
                          className={`rounded-full px-2 py-0.5 ${qualify.tone}`}
                        >
                          {qualify.text}
                        </span>
                      ) : (
                        brDate(r.qualifyBy)
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {ends && r.status === "exigencia" ? (
                        <span
                          className={`rounded-full px-2 py-0.5 ${ends.tone}`}
                        >
                          {ends.text}
                        </span>
                      ) : (
                        brDate(r.prenotationEnds)
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{statusText(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </RiPage>
  );
}
