import Link from "next/link";
import { ATTRIBUTION_GUIDES, offersGuide } from "@/core/attributions/guides.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { GUIDE_ICONS, requireGuides } from "./_lib.ts";

export const metadata = { title: "Atribuições" };

export default async function AttributionsPage() {
  await requireGuides();
  const tenant = await getTenant();
  const guides = ATTRIBUTION_GUIDES.filter((g) => offersGuide(g, tenant));
  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Atribuições"
        description="Cada especialidade da serventia: o que faz, a lei, os livros e índices que a lei exige, os prazos e o que o painel já faz por ela."
      />
      <main className="grid max-w-[1100px] gap-4 px-4 py-7 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/admin/atribuicoes/${guide.slug}`}
            className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AdminIcon
                  name={GUIDE_ICONS[guide.slug] ?? "file"}
                  className="h-4.5 w-4.5"
                />
              </span>
              <span className="font-semibold text-foreground">
                {guide.title}
              </span>
            </span>
            <span className="text-sm text-muted-foreground text-justify hyphens-auto">
              {guide.summary}
            </span>
            <span className="mt-auto pt-2 text-xs text-muted-foreground">
              {guide.books.length + guide.indexes.length > 0
                ? `${guide.books.length + guide.indexes.length} livros e índices da lei`
                : "Livros no Código de Normas do RN"}
              {" · "}
              {guide.acts.length} atos
            </span>
          </Link>
        ))}
      </main>
    </>
  );
}
