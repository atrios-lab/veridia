import Link from "next/link";
import {
  BOOK_NUMBERS,
  BOOKS,
  formLabel,
  nextVolume,
  shortDate,
  termSignaturesOf,
  tomosOf,
} from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { officeToday } from "@/lib/ri-protocols.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { BookForm, ProtocolDay } from "../_components/book-form.tsx";
import { ActionButton } from "../_components/client.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi, riCan } from "../_lib.ts";
import { openIndexBooksAction } from "../actions.ts";

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
  const book2 = rows.find((r) => r.book === 2 && !r.deletedAt && !r.closedOn);
  const visible = rows.filter((r) => Boolean(r.deletedAt) === showDeleted);
  const suggestions = Object.fromEntries(
    BOOK_NUMBERS.map((n) => [
      n,
      // Livro 1 needs no letter: many may be "1" (decision of 28/11/2026).
      n === 1
        ? "1"
        : nextVolume(
            n,
            rows
              .filter((r) => r.book === n && !r.deletedAt)
              .map((r) => r.volume),
          ),
    ]),
  );
  const deletedCount = rows.filter((r) => r.deletedAt).length;
  // The order of the volumes of each book: Tomo 1, 2… and the one in use.
  const tomos = tomosOf(rows);
  // The termo still to sign: abertura, or encerramento once closed.
  const toSign = (r: (typeof rows)[number]) => {
    const signed = termSignaturesOf(r.termSignatures);
    if (!signed.abertura) return "abertura";
    if (r.closedOn && !signed.encerramento) return "encerramento";
    return null;
  };
  return (
    <RiPage
      wide
      title="Livros e termos"
      description="Os cinco livros do Registro de Imóveis (Lei nº 6.015/1973, art. 173). Cada linha mostra os tomos na ordem, o que está em uso e o que falta assinar (art. 4º). Clique num tomo para abrir o livro, os termos e a impressão."
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
          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="hidden grid-cols-[13rem_1fr_12rem] gap-4 border-b px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
              <span>Livro</span>
              <span>Tomos (do primeiro ao em uso)</span>
              <span>A assinar</span>
            </div>
            <ul className="divide-y">
              {BOOK_NUMBERS.map((n) => {
                const info = BOOKS[n];
                const list = visible
                  .filter((r) => r.book === n)
                  .sort(
                    (a, b) =>
                      (tomos.get(a.id)?.tomo ?? 0) -
                      (tomos.get(b.id)?.tomo ?? 0),
                  );
                const pending = list.find((r) => !r.deletedAt && toSign(r));
                return (
                  <li
                    key={n}
                    className="grid gap-3 px-4 py-3.5 md:grid-cols-[13rem_1fr_12rem] md:items-center md:gap-4"
                  >
                    <div>
                      <p className="font-semibold">{info.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.source}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          {showDeleted
                            ? "Nenhum livro apagado."
                            : n === 4 || n === 5
                              ? "Nenhum aberto. O sistema já monta este índice com as matrículas e as pessoas."
                              : "Nenhum livro aberto ainda."}
                        </p>
                      ) : (
                        list.map((r) => {
                          const t = tomos.get(r.id);
                          const current = !r.closedOn && !r.deletedAt;
                          return (
                            <Link
                              key={r.id}
                              href={`/admin/ri/livros/${r.id}`}
                              className={`flex flex-col rounded-lg border px-3 py-1.5 transition-colors hover:bg-muted/50 ${current ? "border-2 border-primary bg-primary-soft/40" : ""}`}
                            >
                              <span className="text-sm font-semibold">
                                {t ? `Tomo ${t.tomo} · ` : ""}Livro {r.volume}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {r.deletedAt
                                  ? "apagado"
                                  : r.closedOn
                                    ? `${r.openedOn.slice(0, 4)} a ${r.closedOn.slice(0, 4)}${r.lastSheet ? ` · fl. ${r.lastSheet}` : ""}`
                                    : `em uso desde ${shortDate(r.openedOn)}`}
                                {" · "}
                                {formLabel(r.form)
                                  .split(" (")[0]
                                  ?.toLowerCase()}
                              </span>
                            </Link>
                          );
                        })
                      )}
                    </div>
                    <div>
                      {showDeleted ? null : pending ? (
                        <Link
                          href={`/admin/ri/livros/${pending.id}#termos`}
                          className={buttonVariants({ size: "sm" })}
                        >
                          Assinar{" "}
                          {toSign(pending) === "encerramento"
                            ? "encerramento"
                            : "abertura"}
                          {tomos.get(pending.id)
                            ? ` · Tomo ${tomos.get(pending.id)?.tomo}`
                            : ""}
                        </Link>
                      ) : list.length > 0 ? (
                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-text">
                          Tudo assinado
                        </span>
                      ) : (n === 4 || n === 5) && book2 && canManage ? (
                        <ActionButton
                          action={openIndexBooksAction}
                          fields={{}}
                          label="Abrir com o Livro 2"
                          pendingLabel="Abrindo..."
                        />
                      ) : canManage ? (
                        <a
                          href="#abrir"
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline",
                          })}
                        >
                          Abrir o Livro {n}
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {canManage && !showDeleted && (
            <Panel
              id="abrir"
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
