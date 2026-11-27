import Link from "next/link";
import { notFound } from "next/navigation";
import { SignOrPrint } from "@/app/admin/_components/sign-or-print.tsx";
import { can } from "@/core/auth/roles.ts";
import { bookOf, rowOf, volumeOf, volumesOf } from "@/core/books/catalog.ts";
import { db } from "@/db/index.ts";
import { entryInputOf, listBookEntriesWith } from "@/lib/attribution-books.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import { requireGuides } from "../../../_lib.ts";
import {
  BookEntryDeleteButton,
  BookEntryForm,
  BookImportForm,
} from "../../../livros-forms.tsx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; book: string }>;
}) {
  const { slug, book } = await params;
  return { title: bookOf(slug, book)?.name ?? "Livro" };
}

/**
 * One book of Notas, Títulos e Documentos, Pessoas Jurídicas or Protesto:
 * the lançamentos (by volume), lançar, alterar, apagar, importar e exportar.
 */
export default async function AttributionBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; book: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireGuides();
  const { slug, book: key } = await params;
  const book = bookOf(slug, key);
  if (!book) notFound();
  const query = await searchParams;
  const showDeleted = query.apagados === "1";
  const volume = query.volume ?? "";
  const q = (query.q ?? "").trim().toLowerCase();
  const canEdit = can(
    session.user.role ?? "",
    "attributions.import",
    session.user.permissions,
  );
  const tenant = await getTenant();
  const all = await listBookEntriesWith(db, tenant.slug, book, {
    deleted: showDeleted,
  });
  const entries = all.map((r) => ({ row: r, input: entryInputOf(r) }));
  const volumes = volumesOf(entries.map((e) => e.input));
  const shown = entries.filter(
    (e) =>
      (!volume || volumeOf(e.input.data.livroFolha ?? "") === volume) &&
      (!q || rowOf(book, e.input).join(" ").toLowerCase().includes(q)),
  );
  const base = `/admin/atribuicoes/${slug}/livros/${key}`;
  const exp = `${base}/exportar`;
  const link = (params: Record<string, string>) => {
    const s = new URLSearchParams({
      ...(volume ? { volume } : {}),
      ...(showDeleted ? { apagados: "1" } : {}),
      ...params,
    });
    for (const [k, v] of [...s.entries()]) if (!v) s.delete(k);
    return `${base}${s.size ? `?${s}` : ""}`;
  };
  return (
    <>
      <AdminPageHeader
        maxWidth={1200}
        title={book.name}
        description={`Colunas do livro conforme ${book.source}.`}
      />
      <main className="flex max-w-[1200px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <BackLink
          href={`/admin/atribuicoes/${slug}`}
          label="Voltar à atribuição"
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                {showDeleted ? "Apagados" : "Lançamentos"} ({shown.length})
              </h2>
              <Link
                href={link({ apagados: showDeleted ? "" : "1" })}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                {showDeleted ? "Ver os lançamentos" : "Ver apagados"}
              </Link>
            </div>
            {volumes.length > 0 && (
              <nav aria-label="Volumes" className="flex flex-wrap gap-2">
                <Link
                  href={link({ volume: "" })}
                  className={buttonVariants({
                    size: "sm",
                    variant: volume ? "outline" : "default",
                  })}
                >
                  Todos os volumes
                </Link>
                {volumes.map((v) => (
                  <Link
                    key={v}
                    href={link({ volume: v })}
                    className={buttonVariants({
                      size: "sm",
                      variant: volume === v ? "default" : "outline",
                    })}
                  >
                    Livro {v}
                  </Link>
                ))}
              </nav>
            )}
            <form method="get" className="flex gap-2">
              {volume && <input type="hidden" name="volume" value={volume} />}
              <input
                name="q"
                defaultValue={query.q ?? ""}
                placeholder="Buscar por número, nome, natureza..."
                aria-label="Buscar"
                className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <button
                type="submit"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Buscar
              </button>
            </form>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento{q ? " com essa busca" : ""}. Lance ao lado ou
                importe o livro que o cartório já tem.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {shown.slice(0, 300).map(({ row, input }) => {
                  const cells = rowOf(book, input);
                  return (
                    <li key={row.id} className="flex flex-col gap-2 py-3">
                      <p className="text-sm font-medium">
                        Nº {row.number}
                        {cells[1] ? ` · ${cells[1]}` : ""}
                      </p>
                      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                        {book.columns.slice(2).map((c, i) =>
                          cells[i + 2] ? (
                            <div key={c.key} className="min-w-0">
                              <dt className="text-xs text-muted-foreground">
                                {c.label}
                              </dt>
                              <dd className="break-words">{cells[i + 2]}</dd>
                            </div>
                          ) : null,
                        )}
                      </dl>
                      {canEdit && (
                        <div className="flex flex-wrap items-start gap-2">
                          {!showDeleted && (
                            <details className="w-full rounded-lg border p-3">
                              <summary className="cursor-pointer text-sm font-medium">
                                Alterar este lançamento
                              </summary>
                              <div className="pt-3">
                                <BookEntryForm
                                  attribution={slug}
                                  book={key}
                                  columns={book.columns}
                                  id={row.id}
                                  value={Object.fromEntries(
                                    book.columns.map((c, i) => [
                                      c.key,
                                      cells[i] ?? "",
                                    ]),
                                  )}
                                />
                              </div>
                            </details>
                          )}
                          <BookEntryDeleteButton
                            attribution={slug}
                            book={key}
                            id={row.id}
                            number={row.number}
                            restore={showDeleted}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {shown.length > 300 && (
              <p className="text-xs text-muted-foreground">
                Mostrando os 300 primeiros. Use a busca ou escolha o volume; a
                exportação traz todos.
              </p>
            )}
          </section>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
              <h2 className="text-base font-semibold">Exportar e imprimir</h2>
              <SignOrPrint
                pdfHref={`${exp}?formato=pdf`}
                title={book.name}
                size="sm"
              />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["xlsx", "Planilha (Excel)"],
                    ["csv", "CSV"],
                    ["json", "JSON"],
                  ] as const
                ).map(([f, label]) => (
                  <a
                    key={f}
                    href={`${exp}?formato=${f}`}
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    {label}
                  </a>
                ))}
              </div>
              <a
                href={`${exp}?formato=modelo`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Baixar o modelo de planilha deste livro (XLSX)
              </a>
            </section>
            {canEdit && !showDeleted && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
                <h2 className="text-base font-semibold">Importar</h2>
                <BookImportForm
                  attribution={slug}
                  books={[{ key, name: book.name }]}
                  fixedBook={key}
                />
              </section>
            )}
            {canEdit && !showDeleted && (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs">
                <h2 className="text-base font-semibold">Novo lançamento</h2>
                <BookEntryForm
                  attribution={slug}
                  book={key}
                  columns={book.columns}
                />
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
