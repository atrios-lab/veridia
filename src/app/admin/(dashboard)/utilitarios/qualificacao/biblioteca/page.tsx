import Link from "next/link";
import {
  ACTS,
  ATTRIBUTIONS,
  isAttribution,
} from "@/core/qualificacao/qualificacao.ts";
import { db } from "@/db/index.ts";
import { listLibraryWith } from "@/lib/qualificacao.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { TirarDuvida } from "../../../../_components/tirar-duvida.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireQualificacao } from "../_access.ts";
import { LibraryItemForm, MarkLibraryButton } from "../qualificacao-forms.tsx";

export const metadata = { title: "Biblioteca de exigências" };

const BASE = "/admin/utilitarios/qualificacao/biblioteca";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ atribuicao?: string; excluidas?: string }>;
}) {
  await requireQualificacao();
  const { atribuicao = "", excluidas } = await searchParams;
  const attribution = isAttribution(atribuicao) ? atribuicao : "rcpn";
  const removedView = excluidas === "1";
  const tenant = await getTenant();
  const items = await listLibraryWith(db, tenant.slug, attribution, {
    removed: removedView,
  });

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Biblioteca de exigências"
        description="Exigências padronizadas por atribuição e ato, com o que falta, como cumprir e o fundamento. As mais usadas aparecem primeiro. Confira os fundamentos antes de usar: são um ponto de partida, editável."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <TirarDuvida topic="qualificacao" />
        <BackLink
          href="/admin/utilitarios/qualificacao"
          label="Qualificação de títulos"
        />
        <nav aria-label="Atribuições" className="flex flex-wrap gap-2 text-sm">
          {Object.entries(ATTRIBUTIONS).map(([value, label]) => (
            <Link
              key={value}
              href={`${BASE}?atribuicao=${value}`}
              aria-current={attribution === value ? "true" : undefined}
              className={buttonVariants({
                variant: attribution === value ? "secondary" : "ghost",
                size: "sm",
              })}
            >
              {label}
            </Link>
          ))}
          <Link
            href={
              removedView
                ? `${BASE}?atribuicao=${attribution}`
                : `${BASE}?atribuicao=${attribution}&excluidas=1`
            }
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {removedView ? "Voltar às exigências" : "Ver excluídas"}
          </Link>
        </nav>
        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {ATTRIBUTIONS[attribution]}
              {removedView ? ": excluídas" : ""}
            </h2>
            <span className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "exigência" : "exigências"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {removedView
                ? "Nenhuma exigência excluída."
                : "Ainda não há exigências desta atribuição. Crie a primeira abaixo."}
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 px-5 py-4 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {item.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {item.acts.length
                        ? item.acts
                            .map((a) => ACTS[attribution][a] ?? a)
                            .join(", ")
                        : "Todos os atos"}
                      {item.uses
                        ? ` · usada ${item.uses} ${item.uses === 1 ? "vez" : "vezes"}`
                        : ""}
                    </span>
                  </div>
                  <p className="text-foreground text-justify hyphens-auto">
                    {item.description}
                  </p>
                  <p className="text-muted-foreground text-justify hyphens-auto">
                    <strong className="font-medium text-foreground">
                      Como cumprir:{" "}
                    </strong>
                    {item.howToComply}
                  </p>
                  <p className="text-muted-foreground">
                    <strong className="font-medium text-foreground">
                      Fundamento:{" "}
                    </strong>
                    {item.basis}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {removedView ? (
                      <MarkLibraryButton
                        id={item.id}
                        attribution={attribution}
                        restore
                      />
                    ) : (
                      <>
                        <Link
                          href={`${BASE}/${item.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Alterar
                        </Link>
                        <MarkLibraryButton
                          id={item.id}
                          attribution={attribution}
                        />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {!removedView && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Nova exigência
            </h2>
            <LibraryItemForm />
          </section>
        )}
      </main>
    </>
  );
}
