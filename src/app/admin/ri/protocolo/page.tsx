import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  TERM_SIGN_FORMATS,
  termSignaturesOf,
  tomoLabel,
  tomosOf,
  volumeLetter,
  volumeName,
  volumeOfNumber,
} from "@/core/ri/books.ts";
import { brDate } from "@/core/ri/property.ts";
import { weekdayName } from "@/core/ri/protocol-days.ts";
import {
  capacityOf,
  faceLabel,
  fullFaces,
  pagingOf,
  SHEET_LAYOUT,
} from "@/core/ri/protocol-sheets.ts";
import { type ProtocolTone, protocolView } from "@/core/ri/protocol-view.ts";
import { addDays } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { pendingDaysWith } from "@/lib/ri-protocol-days.ts";
import { bookSheetsWith } from "@/lib/ri-protocol-sheets.ts";
import {
  countersOf,
  listProtocolsWith,
  officeToday,
} from "@/lib/ri-protocols.ts";
import { printSignersWith } from "@/lib/ri-signers.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { ActionButton } from "../_components/client.tsx";
import { ImportSheetForm } from "../_components/import-sheet.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { PrintPicker } from "../_components/print-picker.tsx";
import { ProtocolPagingForm } from "../_components/protocol-paging-form.tsx";
import { ProtocolTabs } from "../_components/protocol-tabs.tsx";
import { ProtocolVolumesForm } from "../_components/protocol-volumes-form.tsx";
import { requireRi, riCan } from "../_lib.ts";
import {
  importProtocolBookAction,
  openProtocolVolumesAction,
} from "../actions.ts";
import { statusText } from "./_shared.ts";

export const metadata = { title: "Protocolo (Livro 1)" };

const VIEWS = [
  ["abertos", "Em andamento"],
  ["prazo", "Vencem hoje"],
  ["exigencia", "Em exigência"],
  ["registrados", "Registrados"],
  ["exame", "Exame e cálculo"],
  ["todos", "Todos"],
  ["apagados", "Apagados"],
] as const;

/** The colour of each meaning, the same on every screen. */
const TONE_CHIP: Record<ProtocolTone, string> = {
  red: "bg-destructive-soft text-destructive",
  amber: "bg-warning-soft text-warning-text",
  blue: "bg-primary-soft text-primary",
  green: "bg-success-soft text-success-text",
  gray: "bg-muted text-muted-foreground",
};
const TONE_BAR: Record<ProtocolTone, string> = {
  red: "bg-destructive",
  amber: "bg-warning",
  blue: "bg-primary",
  green: "bg-success",
  gray: "bg-muted-foreground",
};

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
  const tomorrow = addDays(today, 1);
  const views = new Map(
    all.map((r) => [r.id, protocolView(r, today, tomorrow)]),
  );
  const isOpen = (r: (typeof all)[number]) =>
    r.kind === "prenotacao" &&
    ["prenotado", "exigencia", "duvida"].includes(r.status);
  const inView = (r: (typeof all)[number], v: (typeof VIEWS)[number][0]) =>
    v === "exame"
      ? r.kind === "exame"
      : v === "abertos"
        ? isOpen(r)
        : v === "prazo"
          ? r.kind === "prenotacao" &&
            r.status === "prenotado" &&
            Boolean(r.qualifyBy && r.qualifyBy <= tomorrow)
          : v === "exigencia"
            ? r.kind === "prenotacao" && r.status === "exigencia"
            : v === "registrados"
              ? r.status === "registrado"
              : true;
  const counts = Object.fromEntries(
    VIEWS.map(([v]) => [v, all.filter((r) => inView(r, v)).length]),
  ) as Record<(typeof VIEWS)[number][0], number>;
  const rows = all
    .filter((r) => (q ? true : inView(r, view)))
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
  const tab = params.aba === "livro" ? "livro" : "titulos";
  // Which volume of the Livro 1 is in use, and whether its termo is signed.
  const tomo = book1
    ? tomosOf(await listBooksWith(db, tenant.slug)).get(book1.id)
    : undefined;
  const opening = book1
    ? termSignaturesOf(book1.termSignatures).abertura
    : undefined;
  // Today, as the book stands (decision of 28/11/2026: the day's work first).
  const pending = (await pendingDaysWith(db, tenant.slug, today))
    .filter((d) => d < today)
    .sort();
  const todayCount = prenotations.filter((r) => r.presentedOn === today).length;
  const exigencias = all.filter(
    (r) => r.kind === "prenotacao" && r.status === "exigencia" && !r.voidedAt,
  ).length;
  const nextFace = sheets?.pagination.next;
  const canEdit = riCan(session, "ri.edit");
  const allTomos = tomosOf(await listBooksWith(db, tenant.slug));
  const capacity = sheets ? capacityOf(sheets.paging) : null;
  const lastFull = sheets ? fullFaces(sheets.pagination).at(-1) : undefined;
  const sheetsLeft =
    paged?.sheetCount && nextFace
      ? paged.sheetCount - nextFace.sheet + (nextFace.side === "frente" ? 1 : 0)
      : null;
  const faceUsed = nextFace
    ? Math.round((nextFace.line / SHEET_LAYOUT.linesPerSide) * 100)
    : 0;
  return (
    <RiPage
      wide
      title="Protocolo · Livro 1"
      description={
        book1 ? (
          <>
            {volumeName(book1.volume)}
            {tomo && <strong> · {tomoLabel(tomo)}</strong>}
            {` · aberto em ${brDate(book1.openedOn)}`}
            {book1.firstItem
              ? ` · nº ${book1.firstItem.toLocaleString("pt-BR")} ${book1.lastItem ? `a ${book1.lastItem.toLocaleString("pt-BR")}` : "em diante"}`
              : ""}
            {nextFace
              ? ` · escriturado até a folha ${faceLabel(nextFace.sheet, nextFace.side)}`
              : ""}
          </>
        ) : (
          "O Livro 1 ainda não foi aberto no sistema."
        )
      }
      actions={
        book1 ? (
          <Link
            href={`/admin/ri/livros/${book1.id}#termos`}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${opening ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text"}`}
          >
            {opening
              ? `Termo de abertura assinado ${TERM_SIGN_FORMATS[opening.format]}`
              : "Termo de abertura a assinar"}
          </Link>
        ) : undefined
      }
    >
      <section
        aria-label="Hoje"
        className={`flex flex-wrap items-center gap-4 rounded-xl border border-l-4 bg-card px-5 py-4 shadow-xs ${pending.length ? "border-l-warning" : "border-l-primary"}`}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Hoje · {weekdayName(today)}, {brDate(today)}
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">
            Protocolo do dia aberto ·{" "}
            {todayCount === 1 ? "1 título" : `${todayCount} títulos`}
          </p>
          <p className="text-sm text-muted-foreground">
            Próximo nº{" "}
            <strong className="text-foreground tabular-nums">
              {(lastNumber + 1).toLocaleString("pt-BR")}
            </strong>
            {nextFace && (
              <>
                {" "}
                · cai na{" "}
                <strong className="text-foreground">
                  folha {faceLabel(nextFace.sheet, nextFace.side)}
                </strong>
                , linha {nextFace.line + 1}
              </>
            )}
            {pending.length > 0 && (
              <>
                {" "}
                · a encerrar:{" "}
                <strong className="text-warning-text">
                  {pending.length === 1
                    ? brDate(pending[0] ?? "")
                    : `${pending.length >= 400 ? "400 ou mais" : pending.length} dias, desde ${brDate(pending[0] ?? "")}`}
                </strong>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {pending.length > 0 && (
            <Link
              href="/admin/ri/protocolo/dias"
              className={buttonVariants({ variant: "outline" })}
            >
              Encerrar{" "}
              {pending.length === 1 ? brDate(pending[0] ?? "") : "os dias"}
            </Link>
          )}
          {canEdit && (
            <Link href="/admin/ri/protocolo/novo" className={buttonVariants()}>
              <Plus className="size-4" /> Novo protocolo
            </Link>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(
          [
            [
              "Em andamento",
              counters.open,
              "títulos no prazo ou em exigência",
              "border-l-primary",
              "",
              "abertos",
            ],
            [
              "Qualificação vence hoje",
              counters.qualifyToday,
              "qualificar hoje (art. 188)",
              "border-l-destructive",
              counters.qualifyToday ? "text-destructive" : "",
              "prazo",
            ],
            [
              "Qualificação vencida",
              counters.qualifyLate,
              counters.qualifyLate ? "fora do prazo" : "nenhuma em atraso",
              "border-l-destructive",
              counters.qualifyLate ? "text-destructive" : "",
              "prazo",
            ],
            [
              "Em exigência",
              exigencias,
              counters.prenotationEnding
                ? `${counters.prenotationEnding} com a prenotação no fim`
                : "prenotação de 20 dias (art. 205)",
              "border-l-warning",
              exigencias ? "text-warning-text" : "",
              "exigencia",
            ],
            [
              "Títulos no livro",
              prenotations.length,
              lastNumber
                ? `próximo nº ${(lastNumber + 1).toLocaleString("pt-BR")}`
                : "nenhum ainda",
              "border-l-success",
              "",
              "todos",
            ],
          ] as const
        ).map(([label, value, hint, edge, tone, link]) => (
          <Link
            key={label}
            href={`/admin/ri/protocolo?ver=${link}`}
            className={`rounded-xl border border-l-4 bg-card px-4 py-3 shadow-xs transition-colors hover:bg-muted/40 ${edge}`}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>
              {value.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </div>

      <ProtocolTabs
        active={tab}
        titles={prenotations.length}
        pendingDays={pending.length}
      />

      {tab === "livro" && (
        <>
          {books1.length > 0 && (
            <Panel
              title="Os livros do Protocolo"
              description="Todos são o Livro 1, do primeiro ao em uso (Lei nº 6.015/1973, arts. 4º e 6º). Clique num tomo para abrir o livro, os termos e a assinatura."
            >
              <ol className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
                {[...books1]
                  .sort(
                    (x, y) =>
                      x.openedOn.localeCompare(y.openedOn) ||
                      (x.firstItem ?? 0) - (y.firstItem ?? 0),
                  )
                  .map((b) => {
                    const t = allTomos.get(b.id);
                    const signed = termSignaturesOf(b.termSignatures);
                    const term = b.closedOn
                      ? signed.encerramento
                        ? {
                            ok: true,
                            text: `Termos assinados ${TERM_SIGN_FORMATS[signed.encerramento.format]}`,
                          }
                        : { ok: false, text: "Termo de encerramento a assinar" }
                      : signed.abertura
                        ? {
                            ok: true,
                            text: `Abertura assinada ${TERM_SIGN_FORMATS[signed.abertura.format]}`,
                          }
                        : { ok: false, text: "Termo de abertura a assinar" };
                    return (
                      <li key={b.id}>
                        <Link
                          href={`/admin/ri/livros/${b.id}#termos`}
                          className={`flex h-full flex-col gap-1 rounded-xl border px-4 py-3 transition-colors hover:bg-muted/40 ${b.closedOn ? "bg-muted/20" : "border-2 border-primary bg-primary-soft/40"}`}
                        >
                          <span className="flex items-center gap-2">
                            <strong className="text-base">
                              Tomo {t?.tomo ?? ""}
                            </strong>
                            <span
                              className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.closedOn ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary"}`}
                            >
                              {b.closedOn ? "Encerrado" : "Em uso"}
                            </span>
                          </span>
                          <span className="text-sm">
                            {volumeName(b.volume)}
                            {b.firstItem
                              ? ` · nº ${b.firstItem.toLocaleString("pt-BR")} ${b.lastItem ? `a ${b.lastItem.toLocaleString("pt-BR")}` : "em diante"}`
                              : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {b.closedOn
                              ? `${brDate(b.openedOn)} a ${brDate(b.closedOn)}${b.lastSheet ? ` · encerrado na folha ${b.lastSheet}` : ""}`
                              : `desde ${brDate(b.openedOn)}${nextFace && b.id === book1?.id ? ` · até a folha ${faceLabel(nextFace.sheet, nextFace.side)}` : ""}`}
                          </span>
                          <span
                            className={`mt-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${term.ok ? "bg-success-soft text-success-text" : "bg-warning-soft text-warning-text"}`}
                          >
                            {term.text}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ol>
            </Panel>
          )}

          {!book1 && (
            <Panel title="O Livro 1 ainda não foi aberto no sistema">
              <p className="text-sm text-muted-foreground">
                {prenotations.length > 0 && riCan(session, "ri.books")
                  ? `Há ${prenotations.length.toLocaleString("pt-BR")} títulos no Protocolo, do nº ${firstNumber.toLocaleString("pt-BR")} ao ${lastNumber.toLocaleString("pt-BR")}. Abra o Livro 1 com eles (em uso, forma híbrida); se o livro antigo tinha letras, separe depois em "Abrir os livros do Protocolo".`
                  : 'Abra os livros em "Abrir os livros do Protocolo", abaixo.'}
              </p>
              {prenotations.length > 0 && riCan(session, "ri.books") && (
                <div className="mt-3">
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
                </div>
              )}
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.65fr_1fr]">
            {book1 ? (
              <Panel
                title="Imprimir ou assinar"
                description="Escolha o que, quem rubrica e assina, e como. Tudo num lugar só."
              >
                <PrintPicker
                  signers={printSigners.signers.map((p) => ({
                    index: p.index,
                    label: `${p.name}${p.title ? ` · ${p.title}` : ""}`,
                    hasSignature: Boolean(p.signatureImage),
                    hasRubric: Boolean(p.rubricImage),
                  }))}
                  defaultIndex={printSigners.defaultIndex}
                  today={today}
                  groups={[
                    ...(paged && sheets
                      ? [
                          {
                            label: "Folhas",
                            options: [
                              ...(lastFull
                                ? [
                                    {
                                      label: "Completas",
                                      href: `/admin/ri/livros/${paged.id}/folhas?ate_folha=${lastFull.side === "verso" || !sheets.paging.bothSides ? lastFull.sheet : lastFull.sheet - 1}`,
                                    },
                                  ]
                                : []),
                              {
                                label: `Em andamento (${faceLabel(sheets.pagination.next.sheet, sheets.pagination.next.side)})`,
                                href: `/admin/ri/livros/${paged.id}/folhas?folha=${sheets.pagination.next.sheet}&ate_folha=${sheets.pagination.next.sheet}`,
                              },
                              {
                                label: "De hoje",
                                href: `/admin/ri/livros/${paged.id}/folhas?de=${today}&ate=${today}`,
                              },
                              {
                                label: "Todas",
                                href: `/admin/ri/livros/${paged.id}/folhas`,
                              },
                            ],
                          },
                        ]
                      : []),
                    {
                      label: "Livro inteiro",
                      options: [
                        {
                          label: `${volumeName(book1.volume)} inteiro (termos e folhas)`,
                          href: `/admin/ri/livros/${book1.id}/pdf`,
                          word: `/admin/ri/livros/${book1.id}/pdf?formato=word`,
                        },
                      ],
                    },
                    {
                      label: "Termo de abertura",
                      options: [
                        {
                          label: `Termo de abertura do ${volumeName(book1.volume)}`,
                          href: `/admin/ri/livros/${book1.id}/termo?tipo=abertura`,
                          word: `/admin/ri/livros/${book1.id}/termo?tipo=abertura&formato=word`,
                        },
                      ],
                    },
                    ...(book1.closedOn
                      ? [
                          {
                            label: "Termo de encerramento",
                            options: [
                              {
                                label: `Termo de encerramento do ${volumeName(book1.volume)}`,
                                href: `/admin/ri/livros/${book1.id}/termo?tipo=encerramento`,
                                word: `/admin/ri/livros/${book1.id}/termo?tipo=encerramento&formato=word`,
                              },
                            ],
                          },
                        ]
                      : []),
                  ]}
                  period={{
                    href: `/admin/ri/livros/${book1.id}/pdf`,
                    label: "Período",
                  }}
                />
              </Panel>
            ) : (
              <div />
            )}
            <div className="flex flex-col gap-5">
              {paged && (
                <Panel title="Folhas do livro">
                  {sheets ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Próximo título
                          </p>
                          <p className="text-xl font-bold">
                            Folha{" "}
                            {faceLabel(
                              sheets.pagination.next.sheet,
                              sheets.pagination.next.side,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            linha {sheets.pagination.next.line + 1} de{" "}
                            {SHEET_LAYOUT.linesPerSide}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                            Cabem
                          </p>
                          <p className="text-xl font-bold">
                            {capacity?.perSide} por face
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {capacity?.perSheet} por folha ·{" "}
                            {sheetsLeft === null
                              ? "sem limite de folhas"
                              : `${sheetsLeft} ${sheetsLeft === 1 ? "folha restante" : "folhas restantes"}`}
                          </p>
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className="block h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${faceUsed}%` }}
                        />
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Face{" "}
                        {faceLabel(
                          sheets.pagination.next.sheet,
                          sheets.pagination.next.side,
                        )}
                        : {faceUsed}% usada. Título ou termo que não cabe vai
                        inteiro para a face seguinte (Lei nº 6.015/1973, arts.
                        175 e 184; Provimento nº 156/2016-CGJ/RN, arts. 260 e
                        261).
                      </p>
                      {riCan(session, "ri.books") && (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-primary">
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
                  ) : riCan(session, "ri.books") ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm">
                        Diga a partir de qual número o sistema imprime as folhas
                        e em que folha começa. Daí em diante, cada protocolo
                        novo já sai com a sua folha.
                      </p>
                      <ProtocolPagingForm
                        bookId={paged.id}
                        value={pagingOf(paged.paging)}
                        suggestedItem={paged.firstItem}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      As folhas ainda não foram definidas por quem cuida dos
                      livros.
                    </p>
                  )}
                </Panel>
              )}
              <Panel
                title={book1 && !book1.closedOn ? "Livro em uso" : "O livro"}
                description={
                  book1 && tomo
                    ? `${tomoLabel(tomo)} · aberto em ${brDate(book1.openedOn)}`
                    : undefined
                }
              >
                <div className="flex flex-col gap-2">
                  <a
                    href="/admin/ri/protocolo/tabela?formato=xlsx"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Exportar (Excel)
                  </a>
                  <a
                    href="/admin/ri/protocolo/tabela?formato=csv"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Exportar (CSV)
                  </a>
                  {book1 && !book1.closedOn && (
                    <Link
                      href={`/admin/ri/livros/${book1.id}#encerrar`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Encerrar o livro e abrir o próximo tomo
                    </Link>
                  )}
                  {riCan(session, "ri.import") && (
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        Importar o Protocolo que o cartório já tem
                      </summary>
                      <div className="flex flex-col gap-2 pt-3">
                        <ImportSheetForm
                          action={importProtocolBookAction}
                          label="Planilha (.xlsx, .csv ou .ods)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Colunas: Nº de ordem, Data, Apresentante, Natureza do
                          título, Atos (anotações) e, se quiser, Situação, Livro
                          (1, 1-A, 1-B…) e Folha. Número que já existe fica como
                          está; título importado não volta a contar prazo.
                        </p>
                      </div>
                    </details>
                  )}
                  {riCan(session, "ri.books") && (
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">
                        Abrir os livros do Protocolo (tomos antigos)
                      </summary>
                      <div className="pt-3">
                        <ProtocolVolumesForm />
                      </div>
                    </details>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {tab === "titulos" && (
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <form className="flex flex-wrap items-center gap-3 border-b p-3">
            <nav
              aria-label="Filtrar os títulos"
              className="flex flex-wrap overflow-hidden rounded-lg border"
            >
              {VIEWS.map(([v, label]) => (
                <Link
                  key={v}
                  href={`/admin/ri/protocolo?ver=${v}`}
                  aria-current={v === view && !q ? "true" : undefined}
                  className={`border-r px-3 py-1.5 text-sm font-semibold last:border-r-0 ${v === view && !q ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                >
                  {label}
                  {v !== "todos" && v !== "apagados" && counts[v] > 0 && (
                    <span className="ml-1.5 tabular-nums opacity-80">
                      {counts[v]}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <input type="hidden" name="ver" value={view} />
            <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
              <span className="sr-only">Buscar</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Nº (2.694 ou 2694), apresentante, CPF, natureza…"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              Buscar
            </button>
          </form>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {view === "abertos" && prenotations.length ? (
                <>
                  Nenhum título em andamento agora. Os{" "}
                  {prenotations.length.toLocaleString("pt-BR")} títulos do livro
                  estão em{" "}
                  <Link
                    href="/admin/ri/protocolo?ver=todos"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Todos
                  </Link>
                  .
                </>
              ) : q ? (
                "Nenhum título encontrado com essa busca."
              ) : (
                "Nenhum título aqui. Lance o título do balcão em Novo protocolo."
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-left text-sm">
                <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Nº de ordem</th>
                    <th className="px-3 py-2.5 font-semibold">Data</th>
                    <th className="px-3 py-2.5 font-semibold">
                      Apresentante e título
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Situação</th>
                    <th className="px-3 py-2.5 font-semibold">Prazo</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">Ação</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const v =
                      views.get(r.id) ?? protocolView(r, today, tomorrow);
                    const letter =
                      r.kind === "prenotacao"
                        ? volumeLetter(volumeOfNumber(r.number, books1) ?? "")
                        : "";
                    const action = r.voidedAt
                      ? "Ver"
                      : r.kind === "prenotacao" && r.status === "prenotado"
                        ? "Qualificar"
                        : r.status === "exigencia"
                          ? "Ver exigência"
                          : r.status === "registrado"
                            ? "Ver atos"
                            : "Abrir";
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/ri/protocolo/${r.id}`}
                            className="font-bold text-primary tabular-nums hover:underline"
                          >
                            {r.kind === "exame" ? "E-" : ""}
                            {r.number.toLocaleString("pt-BR")}
                          </Link>
                          {letter && (
                            <span className="block text-xs text-muted-foreground">
                              Letra {letter}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {brDate(r.presentedOn)}
                          {r.sheetLabel && (
                            <span className="block text-xs text-muted-foreground">
                              folha {r.sheetLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="block font-semibold text-foreground">
                            {r.presenterName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {r.titleKind}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            title={statusText(r)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${r.voidedAt ? TONE_CHIP.gray : TONE_CHIP[v.tone]}`}
                          >
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-current"
                            />
                            {r.voidedAt ? "Lançado por engano" : v.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          {v.due && !r.voidedAt ? (
                            <>
                              <span className="text-foreground">
                                até {brDate(v.due)}
                              </span>
                              {v.used !== null && (
                                <span
                                  aria-hidden
                                  className="mt-1.5 block h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                                >
                                  <span
                                    className={`block h-full rounded-full ${TONE_BAR[v.tone]}`}
                                    style={{ width: `${v.used}%` }}
                                  />
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {r.status === "registrado"
                                ? "concluído"
                                : "sem prazo"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/ri/protocolo/${r.id}`}
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                          >
                            {action}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              Mostrando {rows.length.toLocaleString("pt-BR")} de{" "}
              {all.length.toLocaleString("pt-BR")}
            </span>
            <span className="ml-auto flex gap-3">
              <a
                href="/admin/ri/protocolo/tabela?formato=xlsx"
                className="text-primary underline-offset-4 hover:underline"
              >
                Exportar planilha
              </a>
              <a
                href="/admin/ri/protocolo/tabela?formato=csv"
                className="text-primary underline-offset-4 hover:underline"
              >
                CSV
              </a>
            </span>
          </div>
        </section>
      )}
    </RiPage>
  );
}
