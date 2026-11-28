import Link from "next/link";
import { volumeName } from "@/core/ri/books.ts";
import { letterOf, searchIndex } from "@/core/ri/protocol-index.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { protocolIndexWith } from "@/lib/ri-protocol-index.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { printSignersWith } from "@/lib/ri-signers.ts";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { BookPrintOptions } from "../../_components/book-print-options.tsx";
import { Panel, RiPage } from "../../_components/page.tsx";
import { ProtocolTabs } from "../../_components/protocol-tabs.tsx";
import { requireRi } from "../../_lib.ts";

export const metadata = { title: "Índice do Protocolo" };

const brDay = (iso: string) => iso.split("-").reverse().join("/");
/** The most rows the screen shows at once; the file has them all. */
const SHOWN = 500;

/**
 * The índice of the Protocolo, by book (decision of 28/11/2026): the
 * apresentantes in alphabetical order with the date, the natureza, the
 * número and the folha; to consult here and to download (PDF signed as the
 * book, Word, planilha).
 */
export default async function ProtocolIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireRi();
  const params = await searchParams;
  const books = (await listBooksWith(db, tenant.slug))
    .filter((b) => b.book === 1 && !b.deletedAt)
    .sort((a, b) => (a.firstItem ?? 0) - (b.firstItem ?? 0));
  const chosen =
    books.find((b) => b.id === params.livro) ??
    books.find((b) => !b.closedOn) ??
    books[0];
  const index = chosen ? await protocolIndexWith(db, tenant, chosen.id) : null;
  const q = (params.q ?? "").trim();
  const found = index ? searchIndex(index.entries, q) : [];
  const signers = await printSignersWith(db, tenant);
  const file = chosen
    ? `/admin/ri/protocolo/indice/arquivo?livro=${chosen.id}`
    : "";
  return (
    <RiPage
      wide
      title="Índice do Protocolo"
      description="Os apresentantes de cada livro em ordem alfabética, com a data, a natureza do título, o número de ordem e a folha. Índice auxiliar da serventia (Provimento nº 156/2016-CGJ/RN, art. 73)."
      back={{ href: "/admin/ri/protocolo", label: "Protocolo" }}
    >
      <ProtocolTabs active="indice" />
      {!chosen || !index ? (
        <Panel title="Nenhum livro do Protocolo aberto">
          <p className="text-sm text-muted-foreground">
            Abra o Livro 1 na aba Protocolo para ter o índice.
          </p>
        </Panel>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-xs">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="indice-livro" className="text-sm font-medium">
                Livro
              </label>
              <NativeSelect
                id="indice-livro"
                name="livro"
                defaultValue={chosen.id}
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {volumeName(b.volume)}
                    {b.firstItem ? ` · nº ${b.firstItem}` : ""}
                    {b.lastItem ? ` a ${b.lastItem}` : " em diante"}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex min-w-64 flex-1 flex-col gap-1.5">
              <label htmlFor="indice-q" className="text-sm font-medium">
                Consultar
              </label>
              <Input
                id="indice-q"
                name="q"
                defaultValue={q}
                placeholder="Nome do apresentante, natureza ou número"
                className="bg-background"
              />
            </div>
            <Button type="submit">Consultar</Button>
          </form>

          <Panel
            title="Baixar o índice"
            description="Com a rubrica em todas as folhas, a assinatura no encerramento e a assinatura digital, como o livro; ou em planilha."
          >
            <BookPrintOptions
              signers={signers.signers.map((p) => ({
                index: p.index,
                label: `${p.name}${p.title ? ` · ${p.title}` : ""}`,
                hasSignature: Boolean(p.signatureImage),
                hasRubric: Boolean(p.rubricImage),
              }))}
              defaultIndex={signers.defaultIndex}
              today={officeToday()}
              targets={[
                {
                  label: `Índice do ${volumeName(index.volume)}`,
                  href: file,
                  word: `${file}&formato=word`,
                },
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`${file}&formato=xlsx`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Planilha (Excel)
              </a>
              <a
                href={`${file}&formato=csv`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                CSV
              </a>
            </div>
          </Panel>

          <Panel
            title={`${found.length.toLocaleString("pt-BR")} ${found.length === 1 ? "título" : "títulos"}${q ? ` para "${q}"` : ""}`}
          >
            {found.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nada encontrado neste livro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">
                        Nome do apresentante
                      </th>
                      <th className="px-2 py-2 font-medium">Data</th>
                      <th className="px-2 py-2 font-medium">
                        Natureza do título
                      </th>
                      <th className="px-2 py-2 font-medium">Nº de ordem</th>
                      <th className="px-2 py-2 font-medium">Folha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {found.slice(0, SHOWN).map((e, i) => {
                      const letter = letterOf(e.presenter);
                      const prev = found[i - 1];
                      const newLetter =
                        !prev || letterOf(prev.presenter) !== letter;
                      return (
                        <tr key={e.number}>
                          <td className="px-2 py-1.5">
                            {newLetter && (
                              <span className="mr-2 inline-flex size-6 items-center justify-center rounded bg-muted text-xs font-semibold">
                                {letter}
                              </span>
                            )}
                            {e.presenter}
                          </td>
                          <td className="px-2 py-1.5 text-xs">
                            {brDay(e.presentedOn)}
                          </td>
                          <td className="px-2 py-1.5">{e.titleKind}</td>
                          <td className="px-2 py-1.5">
                            <Link
                              href={`/admin/ri/protocolo?q=${e.number}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {e.number.toLocaleString("pt-BR")}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 text-xs">
                            {e.sheet || "não informada"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {found.length > SHOWN && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mostrando os primeiros {SHOWN}. Consulte pelo nome ou baixe
                    o índice inteiro.
                  </p>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </RiPage>
  );
}
