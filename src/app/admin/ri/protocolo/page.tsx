import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print.tsx";
import { volumeLetter, volumeName, volumeOfNumber } from "@/core/ri/books.ts";
import { brDate } from "@/core/ri/property.ts";
import {
  capacityOf,
  faceLabel,
  fullFaces,
  pagingOf,
  SHEET_LAYOUT,
} from "@/core/ri/protocol-sheets.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { bookSheetsWith } from "@/lib/ri-protocol-sheets.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { printSignersWith } from "@/lib/ri-signers.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { BookPrintOptions } from "../_components/book-print-options.tsx";
import { ActionButton } from "../_components/client.tsx";
import { ImportSheetForm } from "../_components/import-sheet.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { ProtocolPagingForm } from "../_components/protocol-paging-form.tsx";
import { ProtocolVolumesForm } from "../_components/protocol-volumes-form.tsx";
import { requireRi, riCan } from "../_lib.ts";
import {
  importProtocolBookAction,
  openProtocolVolumesAction,
} from "../actions.ts";
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
  // The folhas the system prints (book in folhas or hybrid).
  const paged =
    book1 && ["folhas", "hibrido"].includes(book1.form) ? book1 : null;
  const sheets = paged ? await bookSheetsWith(db, tenant, paged.id) : null;
  const printSigners = await printSignersWith(db, tenant);
  const prenotations = all.filter((r) => r.kind === "prenotacao");
  const firstNumber = prenotations.reduce(
    (n, r) => Math.min(n, r.number),
    Number.MAX_SAFE_INTEGER,
  );
  const lastNumber = prenotations.reduce((n, r) => Math.max(n, r.number), 0);
  // A search looks at every título, whatever the tab (decision of
  // 28/11/2026: "2.694" was not found in "Em andamento"), and a number is
  // compared by its digits, with or without the dot.
  const digits = q.replace(/\D/g, "");
  const byNumber = /^[\d.\s]+$/.test(q) && digits ? Number(digits) : null;
  if (byNumber !== null && view !== "apagados") {
    const exact = all.filter((r) => r.number === byNumber);
    if (exact.length === 1 && exact[0]) {
      redirect(`/admin/ri/protocolo/${exact[0].id}`);
    }
  }
  const rows = all
    .filter((r) =>
      q
        ? true
        : view === "exame"
          ? r.kind === "exame"
          : view === "abertos"
            ? r.kind === "prenotacao" &&
              ["prenotado", "exigencia", "duvida"].includes(r.status)
            : true,
    )
    .filter(
      (r) =>
        !q ||
        (byNumber !== null
          ? r.number === byNumber
          : [r.number, r.presenterName, r.presenterDocument, r.titleKind]
              .join(" ")
              .toLowerCase()
              .includes(q)),
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
          <Link
            href="/admin/ri/protocolo/indice"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Índice do Protocolo
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
                  <span className="font-medium">
                    {volumeName(book1.volume)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · aberto em {brDate(book1.openedOn)}
                    {book1.closedOn
                      ? ` · encerrado em ${brDate(book1.closedOn)}`
                      : " · em uso"}
                  </span>
                </p>
                <BookPrintOptions
                  signers={printSigners.signers.map((p) => ({
                    index: p.index,
                    label: `${p.name}${p.title ? ` · ${p.title}` : ""}`,
                    hasSignature: Boolean(p.signatureImage),
                    hasRubric: Boolean(p.rubricImage),
                  }))}
                  defaultIndex={printSigners.defaultIndex}
                  today={today}
                  targets={[
                    {
                      label: `${volumeName(book1.volume)} inteiro (termos e folhas)`,
                      href: `/admin/ri/livros/${book1.id}/pdf`,
                      word: `/admin/ri/livros/${book1.id}/pdf?formato=word`,
                    },
                    {
                      label: `Termo de abertura do ${volumeName(book1.volume)}`,
                      href: `/admin/ri/livros/${book1.id}/termo?tipo=abertura`,
                      word: `/admin/ri/livros/${book1.id}/termo?tipo=abertura&formato=word`,
                    },
                    ...(book1.closedOn
                      ? [
                          {
                            label: `Termo de encerramento do ${volumeName(book1.volume)}`,
                            href: `/admin/ri/livros/${book1.id}/termo?tipo=encerramento`,
                            word: `/admin/ri/livros/${book1.id}/termo?tipo=encerramento&formato=word`,
                          },
                        ]
                      : []),
                  ]}
                  period={{
                    href: `/admin/ri/livros/${book1.id}/pdf`,
                    label:
                      "Imprimir por período (diário, mensal, semestral ou anual)",
                  }}
                />
                {!book1.closedOn && (
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
              <>
                <p className="text-sm text-muted-foreground">
                  O Livro 1 ainda não foi aberto no sistema, por isso não há
                  termos para imprimir.
                  {prenotations.length > 0 && riCan(session, "ri.books")
                    ? ` Há ${prenotations.length.toLocaleString("pt-BR")} títulos no Protocolo, do nº ${firstNumber.toLocaleString("pt-BR")} ao ${lastNumber.toLocaleString("pt-BR")}. Abra o Livro 1 com eles (em uso, forma híbrida); se o livro antigo tinha letras, separe depois em "Abrir os livros do Protocolo".`
                    : ' Abra os livros em "Abrir os livros do Protocolo", logo abaixo.'}
                </p>
                {prenotations.length > 0 && riCan(session, "ri.books") && (
                  <ActionButton
                    action={openProtocolVolumesAction}
                    fields={{
                      "livro-0": "",
                      "de-0": String(firstNumber),
                      "ate-0": "",
                      "forma-0": "hibrido",
                      "folhas-0": "",
                    }}
                    label="Abrir o Livro 1 com esses títulos"
                    pendingLabel="Abrindo..."
                    variant="default"
                  />
                )}
              </>
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
              (anotações) e, se quiser, Situação e Livro (1, 1-A, 1-B…). Com a
              coluna Livro, os livros abrem sozinhos na importação. Número que
              já existe fica como está; título importado não volta a contar
              prazo.
            </p>
          </div>
        </div>
      </Panel>

      {paged && (
        <Panel
          title="Folhas do livro"
          description="O Livro 1 corre como no livro de papel: um título depois do outro, com uma linha entre eles, e o termo de encerramento de cada dia logo abaixo do último título do dia, na mesma folha (Lei nº 6.015/1973, arts. 175 e 184; Provimento nº 156/2016-CGJ/RN, arts. 260, parágrafo único, e 261). O dia seguinte continua embaixo. Título ou termo que não cabe no resto da face vai inteiro para a próxima, e o espaço que sobra é inutilizado com um traço."
        >
          {sheets ? (
            (() => {
              const cap = capacityOf(sheets.paging);
              const next = sheets.pagination.next;
              const free = SHEET_LAYOUT.linesPerSide - next.line;
              const fitsHere = Math.floor(free / sheets.paging.entryLines);
              const full = fullFaces(sheets.pagination);
              const lastFull = full.at(-1);
              const left = paged.sheetCount
                ? paged.sheetCount -
                  next.sheet +
                  (next.side === "frente" ? 1 : 0)
                : null;
              return (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        O próximo protocolo cai na
                      </p>
                      <p className="text-lg font-semibold">
                        Folha {faceLabel(next.sheet, next.side)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        linha {next.line + 1} de {SHEET_LAYOUT.linesPerSide}.
                        Cabem mais {fitsHere}{" "}
                        {fitsHere === 1 ? "título" : "títulos"} nesta face
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        Quantos cabem
                      </p>
                      <p className="text-lg font-semibold">
                        {cap.perSide} por face · {cap.perSheet} por folha
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {SHEET_LAYOUT.linesPerSide} linhas por face,{" "}
                        {sheets.paging.entryLines} por título (mais, se o texto
                        pedir); o termo do dia ocupa {SHEET_LAYOUT.termLines}{" "}
                        linhas. Num dia com termo, cabem {cap.perSideWithTerm}{" "}
                        títulos na face.
                      </p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        Folhas do livro
                      </p>
                      <p className="text-lg font-semibold">
                        {left === null
                          ? "Sem limite informado"
                          : `${left} ${left === 1 ? "folha restante" : "folhas restantes"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {paged.sheetCount
                          ? `de ${paged.sheetCount}; quando acabar, abra o próximo livro (Lei nº 6.015/1973, art. 6º).`
                          : "Informe o número de folhas em Livros e assinatura."}
                      </p>
                    </div>
                  </div>
                  <BookPrintOptions
                    signers={printSigners.signers.map((p) => ({
                      index: p.index,
                      label: `${p.name}${p.title ? ` · ${p.title}` : ""}`,
                      hasSignature: Boolean(p.signatureImage),
                      hasRubric: Boolean(p.rubricImage),
                    }))}
                    defaultIndex={printSigners.defaultIndex}
                    today={today}
                    targets={[
                      ...(lastFull
                        ? [
                            {
                              label: "Folhas completas (prontas para o livro)",
                              href: `/admin/ri/livros/${paged.id}/folhas?ate_folha=${lastFull.side === "verso" || !sheets.paging.bothSides ? lastFull.sheet : lastFull.sheet - 1}`,
                            },
                          ]
                        : []),
                      {
                        label: `Folha em andamento (${faceLabel(next.sheet, next.side)})`,
                        href: `/admin/ri/livros/${paged.id}/folhas?folha=${next.sheet}&ate_folha=${next.sheet}`,
                      },
                      {
                        label: "Folhas de hoje",
                        href: `/admin/ri/livros/${paged.id}/folhas?de=${today}&ate=${today}`,
                      },
                      {
                        label: "Todas as folhas do livro",
                        href: `/admin/ri/livros/${paged.id}/folhas`,
                      },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    O termo de cada dia é lavrado no sistema ao encerrar o dia e
                    pode ser assinado digitalmente (Provimento nº
                    156/2016-CGJ/RN, art. 259, § 3º). No papel, a folha entra no
                    livro quando completa; a folha em andamento pode ser
                    impressa para conferência.
                  </p>
                  {riCan(session, "ri.books") && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        Alterar onde começam as folhas
                      </summary>
                      <div className="pt-3">
                        <ProtocolPagingForm
                          bookId={paged.id}
                          value={sheets.paging}
                          suggestedItem={paged.firstItem}
                        />
                      </div>
                    </details>
                  )}
                </div>
              );
            })()
          ) : riCan(session, "ri.books") ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Diga a partir de qual número o sistema imprime as folhas e em
                que folha começa (por exemplo, o nº seguinte ao último lançado à
                mão, na folha seguinte). Daí em diante, cada protocolo novo já
                sai com a sua folha.
              </p>
              <ProtocolPagingForm
                bookId={paged.id}
                value={pagingOf(paged.paging)}
                suggestedItem={paged.firstItem}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              As folhas ainda não foram definidas por quem cuida dos livros.
            </p>
          )}
        </Panel>
      )}

      {books1.length > 0 && (
        <Panel
          title="Os livros do Protocolo"
          description="Todos são o Livro 1; a letra do livro antigo fica entre parênteses. Cada um com os seus números, o PDF e os termos de abertura e de encerramento (Lei nº 6.015/1973, art. 4º)."
        >
          <ul className="divide-y text-sm">
            {[...books1]
              .sort(
                (a, b) =>
                  (a.firstItem ?? 0) - (b.firstItem ?? 0) ||
                  a.openedOn.localeCompare(b.openedOn),
              )
              .map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <Link
                      href={`/admin/ri/livros/${b.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {volumeName(b.volume)}
                    </Link>
                    <span className="text-muted-foreground">
                      {b.firstItem ? ` · nº ${b.firstItem}` : ""}
                      {b.lastItem
                        ? ` a ${b.lastItem}`
                        : b.firstItem
                          ? " em diante"
                          : ""}
                      {` · aberto em ${brDate(b.openedOn)}`}
                      {b.closedOn
                        ? ` · encerrado em ${brDate(b.closedOn)}`
                        : " · em uso"}
                    </span>
                  </span>
                  <div className="flex w-full flex-col gap-2 sm:grid sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Livro
                      </p>
                      <SignOrPrint
                        pdfHref={`/admin/ri/livros/${b.id}/pdf`}
                        title={`${volumeName(b.volume)} (Protocolo)`}
                        size="sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Termo de abertura
                      </p>
                      <SignOrPrint
                        pdfHref={`/admin/ri/livros/${b.id}/termo?tipo=abertura`}
                        title={`Termo de abertura do ${volumeName(b.volume)}`}
                        size="sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Termo de encerramento
                      </p>
                      {b.closedOn ? (
                        <SignOrPrint
                          pdfHref={`/admin/ri/livros/${b.id}/termo?tipo=encerramento`}
                          title={`Termo de encerramento do ${volumeName(b.volume)}`}
                          size="sm"
                        />
                      ) : (
                        <Link
                          href={`/admin/ri/livros/${b.id}#encerrar`}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Em uso. Encerrar o livro
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      )}

      {riCan(session, "ri.books") && (
        <Panel
          title="Abrir os livros do Protocolo"
          description="Para o Protocolo que veio do livro físico: todos são o Livro 1, e a letra que o livro antigo tinha (A, B…) fica à parte. Preencha um livro por linha e use “Adicionar outro livro” para os demais; o sistema tira as datas dos títulos importados."
        >
          <ProtocolVolumesForm />
        </Panel>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          [
            "Títulos no livro",
            `${prenotations.length.toLocaleString("pt-BR")}${lastNumber ? ` (próximo nº ${(lastNumber + 1).toLocaleString("pt-BR")})` : ""}`,
            "",
          ],
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
            {view === "abertos" && prenotations.length ? (
              <>
                Nenhum título em andamento agora. Os{" "}
                {prenotations.length.toLocaleString("pt-BR")} títulos do livro
                (os importados já estão registrados ou cessados) estão em{" "}
                <Link
                  href="/admin/ri/protocolo?ver=todos"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Todos
                </Link>
                .
              </>
            ) : (
              "Lance o título no balcão em Novo protocolo."
            )}
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
                      {r.kind === "prenotacao" &&
                        volumeLetter(
                          volumeOfNumber(r.number, books1) ?? "",
                        ) && (
                          <span className="block text-xs text-muted-foreground">
                            Letra{" "}
                            {volumeLetter(
                              volumeOfNumber(r.number, books1) ?? "",
                            )}
                          </span>
                        )}
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
