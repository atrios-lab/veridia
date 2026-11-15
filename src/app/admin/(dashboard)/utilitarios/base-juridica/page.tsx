import Link from "next/link";
import {
  CHECK_LABELS,
  SOURCE_AREAS,
  SOURCE_KINDS,
} from "@/core/conhecimento/base.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listRequestsWith, listSourcesWith } from "@/lib/knowledge.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { requireKnowledge } from "./_access.ts";
import { DismissRequestButton } from "./knowledge-forms.tsx";

export const metadata = { title: "Base jurídica do Assistente Virtual" };

const BASE = "/admin/utilitarios/base-juridica";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ excluidas?: string; antigas?: string }>;
}) {
  await requireKnowledge();
  const { excluidas, antigas } = await searchParams;
  const tenant = await getTenant();
  const removedView = excluidas === "1";
  const [sources, requests] = await Promise.all([
    listSourcesWith(db, tenant.slug, { removed: removedView }),
    removedView
      ? Promise.resolve([])
      : listRequestsWith(db, tenant.slug, { open: true }),
  ]);
  const showOld = antigas === "1";
  const shown = sources.filter((s) => showOld || !s.meta.replacedBy);
  const oldCount =
    sources.length - sources.filter((s) => !s.meta.replacedBy).length;
  const inReview = shown.filter((s) => s.meta.pending?.length).length;

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Base jurídica do Assistente Virtual"
        description="Onde a serventia ensina o Assistente Virtual da qualificação: leis, provimentos, jurisprudência, doutrina e modelos. Todo documento vira Markdown e o arquivo é descartado. O Assistente Virtual não conversa: só aprende com estas fontes e consulta a fonte jurídica oficial."
      />
      <main className="flex max-w-[1100px] flex-col gap-6 px-4 py-7 md:px-8">
        <div className="flex flex-wrap gap-2">
          <Link href={`${BASE}/enviar`} className={buttonVariants()}>
            Enviar fontes
          </Link>
          <Link
            href={`${BASE}/pesquisa`}
            className={buttonVariants({ variant: "outline" })}
          >
            Pesquisar na base
          </Link>
          <Link
            href={removedView ? BASE : `${BASE}?excluidas=1`}
            className={buttonVariants({ variant: "ghost" })}
          >
            {removedView ? "Voltar às fontes" : "Ver excluídas"}
          </Link>
          {!removedView && oldCount > 0 && (
            <Link
              href={showOld ? BASE : `${BASE}?antigas=1`}
              className={buttonVariants({ variant: "ghost" })}
            >
              {showOld
                ? "Esconder versões antigas"
                : `Ver versões antigas (${oldCount})`}
            </Link>
          )}
        </div>

        {requests.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-5">
            <h2 className="text-base font-semibold text-foreground">
              O Assistente Virtual pergunta ({requests.length})
            </h2>
            <p className="text-sm text-foreground text-justify hyphens-auto">
              Ao conferir as fontes nos sites oficiais, o Assistente Virtual
              achou norma alterada ou revogada. Responda pelos botões: importar
              o texto vigente do site oficial, enviar o documento atualizado ou
              dispensar, com o motivo.
            </p>
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-sm"
                >
                  <p className="font-medium text-foreground">{r.topic}</p>
                  {r.detail && (
                    <p className="text-muted-foreground text-justify hyphens-auto">
                      {r.detail}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {r.officialUrl && (
                      <Link
                        href={`${BASE}/enviar?pedido=${r.id}#oficial`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Sim, importar do site oficial
                      </Link>
                    )}
                    {r.sourceId && (
                      <Link
                        href={`${BASE}/${r.sourceId}/alterar?pedido=${r.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Sim, enviar o documento
                      </Link>
                    )}
                    <DismissRequestButton id={r.id} />
                    <span className="text-xs text-muted-foreground">
                      {formatOfficeDate(r.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {removedView ? "Fontes excluídas" : "Fontes"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {shown.length} {shown.length === 1 ? "fonte" : "fontes"}
              {inReview > 0 ? ` · ${inReview} em conferência` : ""}
            </span>
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {removedView
                ? "Nenhuma fonte excluída."
                : "A base ainda está vazia. Comece importando a Lei dos Registros Públicos e o Código Nacional de Normas em Enviar fontes."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={`${BASE}/${s.id}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {s.meta.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_KINDS[s.meta.kind].label}
                      {s.meta.reference ? ` · ${s.meta.reference}` : ""}
                      {s.meta.areas.length
                        ? ` · ${s.meta.areas.map((a) => SOURCE_AREAS[a]).join(", ")}`
                        : " · todas as atribuições"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 text-xs">
                    {s.meta.pending?.length ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning-text">
                        Em conferência
                      </span>
                    ) : null}
                    {s.meta.replacedBy ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Versão antiga
                      </span>
                    ) : null}
                    {s.meta.status === "revogada" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Revogada
                      </span>
                    ) : null}
                    {s.meta.check ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {CHECK_LABELS[s.meta.check.result]}
                      </span>
                    ) : null}
                    <span className="px-1 py-0.5 text-muted-foreground">
                      {s.passages} trechos · {formatOfficeDate(s.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
