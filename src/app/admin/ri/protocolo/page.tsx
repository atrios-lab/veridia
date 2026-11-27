import { Plus } from "lucide-react";
import Link from "next/link";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print.tsx";
import { brDate } from "@/core/ri/property.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { ImportSheetForm } from "../_components/import-sheet.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";
import { importProtocolBookAction } from "../actions.ts";
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
  const books1 = (await listBooksWith(db, tenant.slug)).filter(
    (b) => b.book === 1 && !b.deletedAt,
  );
  const book1 =
    books1.find((b) => !b.closedOn) ??
    books1.sort((a, b) => b.openedOn.localeCompare(a.openedOn))[0];
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
      <Panel
        title="O livro do Protocolo"
        description="Imprimir o Livro 1, os termos de abertura e de encerramento, encerrar o livro, exportar e importar."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            {book1 ? (
              <>
                <p className="text-sm">
                  <span className="font-medium">Livro {book1.volume}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · aberto em {brDate(book1.openedOn)}
                    {book1.closedOn
                      ? ` · encerrado em ${brDate(book1.closedOn)}`
                      : " · em uso"}
                  </span>
                </p>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Imprimir o livro (assinar digitalmente ou à mão)
                  </p>
                  <SignOrPrint
                    pdfHref={`/admin/ri/livros/${book1.id}/pdf`}
                    title={`Livro ${book1.volume} (Protocolo)`}
                    size="sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Termo de abertura
                  </p>
                  <SignOrPrint
                    pdfHref={`/admin/ri/livros/${book1.id}/termo?tipo=abertura`}
                    title={`Termo de abertura do Livro ${book1.volume}`}
                    size="sm"
                  />
                </div>
                {book1.closedOn ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Termo de encerramento
                    </p>
                    <SignOrPrint
                      pdfHref={`/admin/ri/livros/${book1.id}/termo?tipo=encerramento`}
                      title={`Termo de encerramento do Livro ${book1.volume}`}
                      size="sm"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/admin/ri/livros/${book1.id}#encerrar`}
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    Encerrar o livro
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">
                  O encerramento de cada dia (art. 184) fica em
                  &quot;Encerramento dos dias&quot;, acima.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                O Livro 1 ainda não foi lançado no sistema, por isso não há
                termos para imprimir.{" "}
                <Link
                  href="/admin/ri/livros"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Abrir o Livro 1 em Livros e assinatura
                </Link>{" "}
                (com o número e a data do livro em uso). A exportação e a
                importação ao lado já funcionam.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Exportar todos os títulos
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/admin/ri/protocolo/tabela?formato=xlsx"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Planilha (Excel)
                </a>
                <a
                  href="/admin/ri/protocolo/tabela?formato=csv"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  CSV
                </a>
              </div>
            </div>
            {riCan(session, "ri.import") && (
              <ImportSheetForm
                action={importProtocolBookAction}
                label="Importar o Protocolo que o cartório já tem (.xlsx, .csv ou .ods)"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Colunas: Nº de ordem, Data, Apresentante, Natureza do título, Atos
              (anotações) e, se quiser, Situação. Número que já existe fica como
              está; título importado não volta a contar prazo.
            </p>
          </div>
        </div>
      </Panel>

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
