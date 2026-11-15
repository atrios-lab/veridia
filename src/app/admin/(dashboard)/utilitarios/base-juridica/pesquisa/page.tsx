import Link from "next/link";
import {
  SOURCE_AREAS,
  SOURCE_KINDS,
  type SourceArea,
} from "@/core/conhecimento/base.ts";
import { db } from "@/db/index.ts";
import { searchKnowledgeWith } from "@/lib/knowledge.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { TirarDuvida } from "../../../../_components/tirar-duvida.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { NativeSelect } from "../../../../_ui/native-select.tsx";
import { requireKnowledge } from "../_access.ts";
import { MarkdownView } from "../markdown-view.tsx";

export const metadata = { title: "Pesquisar na base jurídica" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; area?: string }>;
}) {
  await requireKnowledge();
  const { q = "", area = "" } = await searchParams;
  const query = q.trim().slice(0, 300);
  const chosen = Object.hasOwn(SOURCE_AREAS, area)
    ? (area as SourceArea)
    : undefined;
  const tenant = await getTenant();
  const hits = query
    ? await searchKnowledgeWith(db, tenant.slug, query, {
        area: chosen,
        limit: 30,
      })
    : [];

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Pesquisar na base jurídica"
        description="Pesquisa feita pelo próprio sistema, sem o Assistente Virtual, só nas fontes em uso: vigentes, conferidas e na versão mais nova. A lei vem antes das normas, da jurisprudência, da doutrina e dos modelos."
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <TirarDuvida topic="base-juridica" />
        <BackLink
          href="/admin/utilitarios/base-juridica"
          label="Base jurídica do Assistente Virtual"
        />
        <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5 shadow-xs">
          <label
            htmlFor="busca-q"
            className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium"
          >
            Palavras ou artigo
            <Input
              id="busca-q"
              name="q"
              defaultValue={query}
              placeholder="Ex.: exigências de uma só vez · art. 198 · prenotação"
              className="font-normal"
            />
          </label>
          <label
            htmlFor="busca-area"
            className="flex flex-col gap-1.5 text-sm font-medium"
          >
            Atribuição
            <NativeSelect
              id="busca-area"
              name="area"
              defaultValue={chosen ?? ""}
            >
              <option value="">Todas</option>
              {Object.entries(SOURCE_AREAS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button type="submit">Pesquisar</Button>
        </form>
        {query && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {hits.length
              ? `${hits.length} ${hits.length === 1 ? "trecho encontrado" : "trechos encontrados"}.`
              : "Nada encontrado nas fontes em uso."}
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {hits.map((h) => (
            <li
              key={`${h.sourceId}-${h.heading}`}
              className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <Link
                  href={`/admin/utilitarios/base-juridica/${h.sourceId}`}
                  className="font-medium text-foreground underline"
                >
                  {h.reference || h.title} · {h.heading}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {SOURCE_KINDS[h.kind].label}
                </span>
              </div>
              <MarkdownView text={h.text} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
