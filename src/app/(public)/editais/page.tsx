import type { PublicationKind } from "@/core/publications/publication.ts";
import { PUBLICATION_KIND_LABELS } from "@/core/publications/publication.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import {
  NOTICE_SECTOR_ATTRIBUTION,
  NOTICE_SECTOR_META,
} from "@/core/tenant/gating.ts";
import type { PublicationRow } from "@/lib/publications.ts";
import { livePublications } from "@/lib/publications.ts";
import { Icon } from "../_components/icon.tsx";
import { requireSection } from "../_lib/section.ts";

export const metadata = { title: "Editais" };

/**
 * Which sector a live publication files under. Banns are always proclamas
 * (the form schema wrote that), and an edital predating the sector column
 * lands in the office's generic group rather than disappearing.
 */
function sectorOf(row: PublicationRow): NoticeSector | null {
  if (row.kind === "marriageBanns") return "proclamas";
  return (row.sector as NoticeSector | null) ?? null;
}

function NoticeCard({ row }: { row: PublicationRow }) {
  return (
    <article className="rounded-2xl border border-brand-border bg-brand-card p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="font-serif text-lg font-semibold text-brand-primary">
          {row.title}
        </h3>
        <span className="rounded-lg bg-brand-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-brand-accent">
          {PUBLICATION_KIND_LABELS[row.kind as PublicationKind]}
        </span>
      </div>
      {row.publishAt && (
        <p className="mt-1 text-xs text-brand-faint">
          Publicado em {formatDate(row.publishAt)}
        </p>
      )}
      {/* The operator writes plain text with line breaks; keep them. */}
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brand-text-soft">
        {row.body}
      </p>
      {row.attachmentPath && (
        <a
          href={`/editais/${row.id}/arquivo`}
          target="_blank"
          rel="noopener"
          className="btn btn-ghost btn-sm mt-3.5 px-0"
        >
          <Icon name="file" className="h-4 w-4 text-brand-accent" />
          Ver o edital assinado
        </a>
      )}
    </article>
  );
}

export default async function PublicNoticesPage() {
  const tenant = await requireSection("editais");

  // Same read the home pays; avisos are home content and stay out of here.
  const live = (await livePublications(tenant.slug)).filter(
    (row) => row.kind !== "notice",
  );

  const groups = new Map<NoticeSector | null, PublicationRow[]>();
  for (const row of live) {
    const sector = sectorOf(row);
    groups.set(sector, [...(groups.get(sector) ?? []), row]);
  }

  // Gating order, generic bucket last. Only sectors with something live
  // appear at all: an empty sector is not information, it is furniture.
  const sectors = (
    Object.keys(NOTICE_SECTOR_ATTRIBUTION) as NoticeSector[]
  ).filter((sector) => (groups.get(sector) ?? []).length > 0);
  const general = groups.get(null) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-10">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
        Publicações oficiais
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
        Editais
      </h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-brand-muted">
        Publicações desta serventia organizadas por setor. Cada atribuição
        publica o seu próprio tipo de edital, conforme a lei.
      </p>

      {sectors.length === 0 && general.length === 0 ? (
        <p className="mt-7 max-w-[60ch] rounded-2xl border border-brand-border bg-brand-card p-5 text-sm leading-relaxed text-brand-muted">
          Nenhum edital publicado no momento. As publicações aparecem aqui assim
          que a serventia as registrar.
        </p>
      ) : (
        <>
          {sectors.length > 1 && (
            <nav className="mt-6 flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <a
                  key={sector}
                  href={`#${sector}`}
                  data-notice-sector={sector}
                  className="btn btn-secondary btn-sm"
                >
                  {NOTICE_SECTOR_META[sector].name}
                </a>
              ))}
            </nav>
          )}

          <div className="mt-7 flex flex-col gap-9">
            {sectors.map((sector) => {
              const meta = NOTICE_SECTOR_META[sector];
              return (
                <section key={sector} id={sector} className="scroll-mt-24">
                  {/* Keep the chip's contract even when there is only one
                      sector and the nav above is not rendered. */}
                  {sectors.length <= 1 && (
                    <span data-notice-sector={sector} className="sr-only" />
                  )}
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">
                    {meta.acronym} · {meta.noticeType}
                  </div>
                  <h2 className="mt-1 font-serif text-xl font-semibold text-brand-primary">
                    {meta.name}
                  </h2>
                  <p className="mt-1 max-w-[70ch] text-sm text-brand-muted">
                    {meta.legalNote}
                  </p>
                  <div className="mt-4 flex flex-col gap-3.5">
                    {(groups.get(sector) ?? []).map((row) => (
                      <NoticeCard key={row.id} row={row} />
                    ))}
                  </div>
                </section>
              );
            })}

            {general.length > 0 && (
              <section id="serventia" className="scroll-mt-24">
                <h2 className="font-serif text-xl font-semibold text-brand-primary">
                  Editais da serventia
                </h2>
                <p className="mt-1 max-w-[70ch] text-sm text-brand-muted">
                  Publicações registradas antes da organização por setor.
                </p>
                <div className="mt-4 flex flex-col gap-3.5">
                  {general.map((row) => (
                    <NoticeCard key={row.id} row={row} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </main>
  );
}
