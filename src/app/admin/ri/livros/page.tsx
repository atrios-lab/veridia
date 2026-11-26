import Link from "next/link";
import {
  BOOK_NUMBERS,
  BOOKS,
  formLabel,
  nextVolume,
  shortDate,
} from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { Badge } from "../../_ui/badge.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { BookForm, ProtocolDay } from "../_components/book-form.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";

export const metadata = { title: "Livros e assinatura" };

/**
 * The books of the Registro de Imóveis: each volume opened and closed
 * with its termo (Lei nº 6.015/1973, art. 4º), printed or signed whole,
 * and the Protocolo closed every day (art. 184).
 */
export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ apagados?: string }>;
}) {
  const { session, tenant } = await requireRi();
  const showDeleted = (await searchParams).apagados === "1";
  const rows = await listBooksWith(db, tenant.slug);
  const canManage = riCan(session, "ri.books");
  const visible = rows.filter((r) => Boolean(r.deletedAt) === showDeleted);
  const suggestions = Object.fromEntries(
    BOOK_NUMBERS.map((n) => [
      n,
      nextVolume(
        n,
        rows.filter((r) => r.book === n && !r.deletedAt).map((r) => r.volume),
      ),
    ]),
  );
  const deletedCount = rows.filter((r) => r.deletedAt).length;
  return (
    <RiPage
      wide
      title="Livros e assinatura"
      description="Os cinco livros do Registro de Imóveis (Lei nº 6.015/1973, art. 173), cada um aberto e encerrado com o seu termo e assinado pelo oficial (art. 4º): digitalmente, com certificado ICP-Brasil, ou impresso para assinar à mão. O livro inteiro sai num PDF só, para imprimir ou assinar de uma vez."
      actions={
        deletedCount > 0 && (
          <Link
            href={
              showDeleted ? "/admin/ri/livros" : "/admin/ri/livros?apagados=1"
            }
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            {showDeleted
              ? "Ver os livros em uso"
              : `Apagados (${deletedCount})`}
          </Link>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {BOOK_NUMBERS.map((n) => {
            const info = BOOKS[n];
            const list = visible.filter((r) => r.book === n);
            return (
              <Panel
                key={n}
                title={info.name}
                description={`${info.purpose[0]?.toUpperCase()}${info.purpose.slice(1)} (${info.source}).`}
              >
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {showDeleted
                      ? "Nenhum livro apagado."
                      : "Nenhum livro aberto no sistema ainda."}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {list.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/ri/livros/${r.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Livro {r.volume}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formLabel(r.form)}
                            {r.sheetCount ? ` · ${r.sheetCount} folhas` : ""}
                            {" · aberto em "}
                            {shortDate(r.openedOn)}
                            {r.closedOn
                              ? ` · encerrado em ${shortDate(r.closedOn)}`
                              : ""}
                          </p>
                        </div>
                        <Badge variant={r.closedOn ? "secondary" : "default"}>
                          {r.deletedAt
                            ? "Apagado"
                            : r.closedOn
                              ? "Encerrado"
                              : "Em uso"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            );
          })}
        </div>

        <div className="flex flex-col gap-5">
          {canManage && !showDeleted && (
            <Panel
              title="Abrir um livro"
              description="Lança o livro no sistema; o termo de abertura sai dele para assinar."
            >
              <BookForm suggestions={suggestions} />
            </Panel>
          )}
          <Panel
            title="Protocolo do dia"
            description="O Protocolo é encerrado diariamente (Lei nº 6.015/1973, art. 184): os títulos apontados no dia, com as colunas do art. 175, e o encerramento, para assinar."
          >
            <ProtocolDay today={officeToday()} />
          </Panel>
          <Panel title="Como fazer">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-foreground">
              <li>
                Escolha o livro e o número. No Registro de Imóveis o número se
                conserva e ganha letras quando o livro acaba: 2, 2-A, 2-B (Lei
                nº 6.015/1973, art. 6º). Podem correr até dez Livros 2 ao mesmo
                tempo, pelo algarismo final da matrícula (art. 181).
              </li>
              <li>
                Diga como o livro é escriturado: em fichas, permitidas para os
                Livros 2 a 5 (art. 173, parágrafo único); em folhas (art. 3º, §
                2º); ou em meio eletrônico (art. 1º, § 3º). No meio eletrônico
                não se aplicam os arts. 3º a 7º (art. 7º-A).
              </li>
              <li>
                Numere e autentique as folhas ou fichas e gere o termo de
                abertura. O livro é aberto, numerado, autenticado e encerrado
                pelo oficial (art. 4º).
              </li>
              <li>
                Assine o termo. Assinam o oficial, o substituto legal ou o
                escrevente designado e autorizado pelo juiz (art. 210).
                Digitalmente, use "Assinar digitalmente" (certificado
                ICP-Brasil, A1 ou A3); à mão, use "Imprimir para assinar à mão".
                Quem assina vem de Configurações do RI.
              </li>
              <li>
                Encerre o Protocolo todo dia, no fim do expediente (art. 184).
                Os títulos só para exame e cálculo não entram no Protocolo (art.
                12, parágrafo único).
              </li>
              <li>
                Quando o livro acabar, encerre-o com a data e a última folha
                escriturada, assine o termo de encerramento e abra o seguinte
                com a letra seguinte (arts. 4º e 6º).
              </li>
              <li>
                Matrículas manuscritas em livros encadernados passam para fichas
                soltas, com o mesmo número e remissão na matrícula de origem
                (Código Nacional de Normas, Provimento CNJ nº 149/2023, art.
                336).
              </li>
              <li>
                Confira o modelo do termo no Código de Normas da Corregedoria do
                seu Estado: o Código Nacional de Normas não traz modelo de termo
                para os livros do Registro de Imóveis.
              </li>
            </ol>
          </Panel>
        </div>
      </div>
    </RiPage>
  );
}
