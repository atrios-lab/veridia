import Link from "next/link";
import {
  BOOK_NUMBERS,
  BOOKS,
  formLabel,
  nextVolume,
  shortDate,
} from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import { listBooksWith, openIndexBooksWith } from "@/lib/ri-books.ts";
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
  // The Livros 4 and 5 open by themselves with the Livro 2 in use: one
  // of each for the whole acervo (decision of 27/11/2026).
  if (riCan(session, "ri.books")) {
    await openIndexBooksWith(db, tenant.slug, { id: session.user.id });
  }
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
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      {showDeleted
                        ? "Nenhum livro apagado."
                        : "Nenhum livro aberto no sistema ainda."}
                    </p>
                    {!showDeleted && (n === 4 || n === 5) && (
                      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
                        <p>
                          Este indicador já está em uso: o sistema o alimenta
                          sozinho com as matrículas e as pessoas lançadas (Lei
                          nº 6.015/1973, art. {n === 4 ? "179" : "180"}). Falta
                          só lançar o livro, para ter o termo de abertura.
                        </p>
                        <p className="text-muted-foreground">
                          Ele abre sozinho, uma vez só, na data do Livro 2 em
                          uso, assim que o Livro 2 for aberto aqui.
                        </p>
                      </div>
                    )}
                  </div>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/admin/ri/livros/${r.id}/termo?tipo=abertura`}
                            target="_blank"
                            rel="noreferrer"
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                          >
                            Termo de abertura
                          </a>
                          {r.closedOn ? (
                            <a
                              href={`/admin/ri/livros/${r.id}/termo?tipo=encerramento`}
                              target="_blank"
                              rel="noreferrer"
                              className={buttonVariants({
                                size: "sm",
                                variant: "outline",
                              })}
                            >
                              Termo de encerramento
                            </a>
                          ) : (
                            r.form !== "folhas" && (
                              <span
                                className="text-xs text-muted-foreground"
                                title="Livro em fichas ou eletrônico não se encerra por estar cheio: cada ficha continua. O encerramento só é feito se o livro for substituído ou por determinação da Corregedoria."
                              >
                                Encerramento: só se for substituído
                              </span>
                            )
                          )}
                          <Badge variant={r.closedOn ? "secondary" : "default"}>
                            {r.deletedAt
                              ? "Apagado"
                              : r.closedOn
                                ? "Encerrado"
                                : "Em uso"}
                          </Badge>
                        </div>
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
                Livro 2 digital: ao assinar a ficha da matrícula nº 1 em Imagens
                do Livro 2 (ONR), o sistema propõe abrir o Livro 2 na data da
                averbação de transporte dela e pergunta se é mesmo a data do 1º
                ato de transporte. As matrículas passam para fichas com a mesma
                numeração e remissão na matrícula de origem (Código Nacional de
                Normas, art. 336; Lei nº 6.015/1973, art. 173, parágrafo único).
                Cada ficha assinada vira a página do livro; o mesmo arquivo
                serve para imprimir.
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
