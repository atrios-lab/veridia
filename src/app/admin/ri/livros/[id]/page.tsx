import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BOOKS,
  type BookNumber,
  batches,
  formLabel,
  shortDate,
} from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import {
  bookFichasWith,
  bookWith,
  historyOf,
  MAX_FICHAS,
} from "@/lib/ri-books.ts";
import { currentOf, listOnrImagesWith } from "@/lib/ri-onr-images.ts";
import {
  SignOrPrint,
  signBatchHref,
} from "../../../_components/sign-or-print.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { BookForm, CloseBookForm } from "../../_components/book-form.tsx";
import { ConfirmButton } from "../../_components/client.tsx";
import { ImportSheetForm } from "../../_components/import-sheet.tsx";
import { Field, Panel, RiPage } from "../../_components/page.tsx";
import { requireRi, riCan, stamp } from "../../_lib.ts";
import {
  importProtocolBookAction,
  reopenBookAction,
  setBookDeletedAction,
} from "../../actions.ts";

export const metadata = { title: "Livro do Registro de Imóveis" };

const display = (n: number | null) => (n === null ? "" : String(n));

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ importar?: string }>;
}) {
  const importing = (await searchParams).importar;
  const { session, tenant } = await requireRi();
  const row = await bookWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const info = BOOKS[row.book as BookNumber];
  const canManage = riCan(session, "ri.books");
  const fichas = await bookFichasWith(db, tenant.slug, row);
  // The Livro 2 is one digital book: the signed fichas are its pages, and
  // a ficha signed again replaces the page; the old one goes to
  // "Alterações".
  const images = row.book === 2 ? await listOnrImagesWith(db, tenant.slug) : [];
  const inBook = (n: number) =>
    n >= (row.firstItem ?? 1) && n <= (row.lastItem ?? Number.MAX_SAFE_INTEGER);
  const pagesNow = currentOf(images).filter((r) => inBook(r.number));
  const replaced = images.filter(
    (r) =>
      !r.deletedAt && inBook(r.number) && !pagesNow.some((c) => c.id === r.id),
  );
  const lots = batches(fichas, 20);
  const base = `/admin/ri/livros/${row.id}`;
  const history = historyOf(row);
  const dateRange = row.book === 1;
  const itemRange = row.book === 2 || row.book === 3;
  return (
    <RiPage
      title={`Livro ${row.volume}`}
      description={`${info.name}. ${info.purpose[0]?.toUpperCase()}${info.purpose.slice(1)} (${info.source}).`}
      back={{ href: "/admin/ri/livros", label: "Livros e assinatura" }}
    >
      {row.deletedAt && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          Livro apagado em {stamp(row.deletedAt)}. Ele continua guardado e pode
          ser restaurado.
        </p>
      )}

      <Panel title="Dados do livro">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Field label="Livro" value={`${info.name} · ${row.volume}`} />
          <Field label="Forma de escrituração" value={formLabel(row.form)} />
          <Field
            label="Folhas ou fichas"
            value={row.sheetCount ? String(row.sheetCount) : "sem número fixo"}
          />
          <Field label="Aberto em" value={shortDate(row.openedOn)} />
          <Field
            label="Encerrado em"
            value={row.closedOn ? shortDate(row.closedOn) : "em uso"}
          />
          {row.closedOn && (
            <Field
              label="Última folha ou ficha escriturada"
              value={display(row.lastSheet)}
            />
          )}
          {row.firstItem !== null && (
            <Field
              label="Abrangência"
              value={`${info.items} do nº ${row.firstItem}${row.lastItem !== null ? ` ao nº ${row.lastItem}` : " em diante"}`}
            />
          )}
        </dl>
      </Panel>

      <Panel
        title="Termos"
        description="O livro é aberto e encerrado pelo oficial (Lei nº 6.015/1973, art. 4º). Assina quem está em Configurações do RI: o oficial, o substituto legal ou o escrevente designado e autorizado pelo juiz (art. 210)."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              Termo de abertura
            </p>
            <SignOrPrint
              pdfHref={`${base}/termo?tipo=abertura`}
              title={`Termo de abertura do Livro ${row.volume}`}
              size="sm"
            />
          </div>
          {row.closedOn ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                Termo de encerramento
              </p>
              <SignOrPrint
                pdfHref={`${base}/termo?tipo=encerramento`}
                title={`Termo de encerramento do Livro ${row.volume}`}
                size="sm"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              O termo de encerramento aparece quando o livro for encerrado.
            </p>
          )}
        </div>
      </Panel>

      <Panel
        title="O livro inteiro num PDF"
        description={
          dateRange
            ? "O termo de abertura, o Protocolo de cada dia com o seu encerramento (arts. 175 e 184) e o termo de encerramento. Escolha o período para um PDF menor."
            : itemRange
              ? `O termo de abertura, as fichas e o termo de encerramento. Até ${MAX_FICHAS} fichas por PDF: para mais, escolha o intervalo.`
              : "O termo de abertura, o indicador tirado do acervo e o termo de encerramento."
        }
      >
        <div className="flex flex-col gap-3">
          {(dateRange || itemRange) && (
            <form
              method="get"
              action={`${base}/pdf`}
              target="_blank"
              className="flex flex-wrap items-end gap-2"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-from">
                  {dateRange ? "De (data)" : "Da matrícula ou registro nº"}
                </Label>
                <Input
                  id="book-from"
                  name="de"
                  type={dateRange ? "date" : "text"}
                  inputMode={dateRange ? undefined : "numeric"}
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="book-to">
                  {dateRange ? "Até (data)" : "Até o nº"}
                </Label>
                <Input
                  id="book-to"
                  name="ate"
                  type={dateRange ? "date" : "text"}
                  inputMode={dateRange ? undefined : "numeric"}
                  className="bg-background"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                Abrir o PDF desse trecho
              </Button>
            </form>
          )}
          <SignOrPrint
            pdfHref={`${base}/pdf`}
            title={`Livro ${row.volume}`}
            size="sm"
          />
          <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
            <p className="text-sm font-medium text-foreground">
              Relatório e tabela
            </p>
            <p className="text-xs text-muted-foreground">
              As mesmas colunas do livro, para conferir, filtrar ou guardar fora
              do sistema.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${base}/tabela?formato=xlsx`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Baixar planilha (Excel)
              </a>
              <a
                href={`${base}/tabela?formato=csv`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Baixar CSV
              </a>
            </div>
          </div>
          <div
            id="importar"
            className={`flex scroll-mt-24 flex-col gap-2 rounded-lg border bg-background p-3 ${importing === "agora" ? "border-primary ring-3 ring-primary/30" : ""}`}
          >
            <p className="text-sm font-medium text-foreground">
              Importar o que o cartório já tem
            </p>
            {importing === "agora" && (
              <p className="text-xs font-medium text-primary">
                Livro aberto. Escolha a planilha abaixo para importar agora.
              </p>
            )}
            {importing === "depois" && (
              <p className="text-xs font-medium text-primary">
                Livro aberto. A importação ficou para depois: quando quiser, é
                aqui, nesta página do livro.
              </p>
            )}
            {row.book === 1 ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Planilha com as colunas Nº de ordem, Data, Apresentante,
                  Natureza do título, Atos (anotações) e, se quiser, Situação: a
                  mesma que &quot;Baixar planilha&quot; gera. Número que já
                  existe fica como está; nenhum título importado volta a contar
                  prazo.
                </p>
                <ImportSheetForm
                  action={importProtocolBookAction}
                  label="Planilha do Protocolo (.xlsx, .csv ou .ods)"
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {row.book === 4 || row.book === 5
                  ? "O indicador se forma sozinho com as matrículas, os atos e as pessoas importados."
                  : "As matrículas, os registros, os atos e as pessoas entram por planilha, JSON ou arquivo da ONR."}{" "}
                <Link
                  href="/admin/ri/importar-exportar"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Abrir Importar e exportar
                </Link>
              </p>
            )}
          </div>
          <form
            method="get"
            action={`${base}/pdf`}
            target="_blank"
            className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="book-seal">Selo dos atos nesta impressão</Label>
              <NativeSelect id="book-seal" name="selo" defaultValue="numero">
                <option value="numero">Só o número</option>
                <option value="imagem">Número e imagem do selo</option>
                <option value="nenhum">Sem selo</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="book-format">Formato</Label>
              <NativeSelect id="book-format" name="formato" defaultValue="pdf">
                <option value="pdf">PDF pronto</option>
                <option value="word">Word, para editar</option>
              </NativeSelect>
            </div>
            {(dateRange || itemRange) && (
              <>
                <Input
                  name="de"
                  aria-label="De"
                  placeholder={dateRange ? "De (AAAA-MM-DD)" : "Da nº"}
                  className="w-36 bg-background"
                />
                <Input
                  name="ate"
                  aria-label="Até"
                  placeholder={dateRange ? "Até (AAAA-MM-DD)" : "Até o nº"}
                  className="w-36 bg-background"
                />
              </>
            )}
            <Button type="submit" size="sm">
              Gerar com essas opções
            </Button>
          </form>
        </div>
      </Panel>

      {row.book === 2 && (
        <Panel
          title={`Páginas assinadas (${pagesNow.length})`}
          description="As fichas assinadas em Imagens do Livro 2 (ONR) entram no livro como páginas, a mesma imagem enviada à ONR. Assinar de novo a mesma matrícula substitui a página; a anterior fica em Alterações."
        >
          {pagesNow.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ficha assinada neste livro ainda.
            </p>
          ) : (
            <p className="text-sm text-foreground">
              Matrículas:{" "}
              {pagesNow.map((r) => r.number.toLocaleString("pt-BR")).join(", ")}
              .
            </p>
          )}
          {replaced.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Alterações: {replaced.length}{" "}
                {replaced.length === 1
                  ? "página substituída"
                  : "páginas substituídas"}
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {replaced.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      Matrícula nº {r.number.toLocaleString("pt-BR")}, página de{" "}
                      {stamp(r.createdAt)}
                    </span>
                    <a
                      href={`/admin/ri/onr/imagens/baixar?id=${r.id}&formato=pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      Ver em PDF
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>
      )}

      {itemRange && (
        <Panel
          title="Assinar as fichas em lote"
          description="Cada ficha vira um PDF assinado com o certificado digital, de 20 em 20: a senha do certificado é digitada uma vez por lote."
        >
          {lots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ficha do acervo cai neste livro ainda.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {lots.map((lot) => {
                const first = lot[0]?.number ?? 0;
                const last = lot.at(-1)?.number ?? 0;
                return (
                  <li key={first}>
                    <a
                      href={signBatchHref(
                        lot.map((f) => ({
                          pdf: `/admin/ri/matriculas/${f.id}/ficha`,
                          title: f.title,
                        })),
                      )}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Assinar nº {first.toLocaleString("pt-BR")} a{" "}
                      {last.toLocaleString("pt-BR")} ({lot.length})
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {canManage && !row.deletedAt && (
        <>
          <Panel
            id="encerrar"
            title={row.closedOn ? "Encerramento" : "Encerrar o livro"}
            description={
              row.closedOn
                ? "Encerrado por engano? Desfaça o encerramento: ele fica no histórico do livro."
                : "Quando o livro acabar: a data, a última folha ou ficha escriturada e, se for o caso, o último número. O próximo livro leva a letra seguinte (art. 6º)."
            }
          >
            {row.closedOn ? (
              <ConfirmButton
                action={reopenBookAction}
                fields={{ id: row.id }}
                trigger="Desfazer o encerramento"
                question={`Desfazer o encerramento do Livro ${row.volume}?`}
                consequence="O livro volta a ficar em uso. O encerramento anterior (data, última folha e observação) fica no histórico e na auditoria. Se o termo de encerramento já foi assinado, guarde-o com a justificativa."
                confirmLabel="Desfazer o encerramento"
                pendingLabel="Desfazendo…"
                destructive={false}
              />
            ) : (
              <CloseBookForm
                id={row.id}
                book={row.book}
                lastItem={display(row.lastItem)}
              />
            )}
          </Panel>
          <Panel title="Alterar os dados do livro">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Mostrar o formulário
              </summary>
              <div className="mt-3">
                <BookForm
                  suggestions={{}}
                  value={{
                    id: row.id,
                    book: row.book,
                    volume: row.volume,
                    form: row.form,
                    sheetCount: row.sheetCount ? String(row.sheetCount) : "",
                    firstItem: display(row.firstItem),
                    lastItem: display(row.lastItem),
                    openedOn: shortDate(row.openedOn),
                    openingNotes: row.openingNotes,
                  }}
                />
              </div>
            </details>
          </Panel>
        </>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {row.deletedAt ? (
            <ConfirmButton
              action={setBookDeletedAction}
              fields={{ id: row.id, op: "restore" }}
              trigger="Restaurar o livro"
              question={`Restaurar o Livro ${row.volume}?`}
              consequence="O livro volta à lista, com os termos e o histórico."
              confirmLabel="Restaurar"
              pendingLabel="Restaurando…"
              destructive={false}
            />
          ) : (
            <ConfirmButton
              action={setBookDeletedAction}
              fields={{ id: row.id }}
              trigger="Apagar o livro"
              question={`Apagar o Livro ${row.volume}?`}
              consequence="Use só para livro lançado por engano. Ele sai da lista, mas continua guardado e pode ser restaurado; as matrículas e o Protocolo não mudam."
              confirmLabel="Apagar"
              pendingLabel="Apagando…"
            />
          )}
        </div>
      )}

      {history.length > 0 && (
        <Panel title="Histórico">
          <ul className="flex flex-col gap-2 text-sm">
            {[...history].reverse().map((h) => (
              <li key={h.at} className="flex flex-col gap-0.5">
                <span className="text-foreground">
                  {stamp(new Date(h.at))}: {h.what}
                </span>
                {Object.keys(h.before).length > 0 && (
                  <span className="text-xs break-words text-muted-foreground">
                    Antes:{" "}
                    {Object.entries(h.before)
                      .map(
                        ([k, v]) =>
                          `${LABELS[k] ?? k}: ${v === null || v === "" ? "vazio" : String(v)}`,
                      )
                      .join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </RiPage>
  );
}

const LABELS: Record<string, string> = {
  volume: "número",
  form: "forma",
  sheetCount: "folhas",
  firstItem: "primeiro nº",
  lastItem: "último nº",
  openedOn: "abertura",
  openingNotes: "observação",
};
