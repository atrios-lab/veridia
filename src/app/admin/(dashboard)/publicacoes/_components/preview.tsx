import type { PublicationKind } from "@/core/publications/publication.ts";
import { PUBLICATION_KIND_LABELS } from "@/core/publications/publication.ts";
import type { NoticeSector } from "@/core/tenant/gating.ts";
import { NOTICE_SECTOR_META } from "@/core/tenant/gating.ts";
import type { Theme } from "@/core/tenant/schema.ts";
import { SERIF } from "@/lib/fonts.ts";

/**
 * How the publication reads inside the "Proclamas e avisos" home section:
 * not the real home page (same trade-off as `VisualIdentityPreview`: an
 * <iframe> of the live site would need a preview session this repository
 * does not have), just the one block this screen is actually asking the
 * operator to judge: title, type and the first line of the text.
 */
export function PublicationPreview({
  theme,
  sealLight,
  officeName,
  kind,
  sector,
  title,
  body,
}: {
  theme: Theme;
  sealLight: string;
  officeName: string;
  kind: PublicationKind;
  sector?: NoticeSector | "";
  title: string;
  body: string;
}) {
  return (
    <div
      data-theme={theme}
      className={`${SERIF[theme].variable} overflow-hidden rounded-[14px] border border-admin-border bg-brand-surface`}
    >
      <div className="flex items-center gap-2 bg-brand-primary px-3.5 py-2.5">
        {/* biome-ignore lint/performance/noImgElement: preview mirrors the
            published site chrome, same trade-off as VisualIdentityPreview. */}
        <img src={sealLight} alt="" className="h-5 w-5 object-contain" />
        <span className="font-serif text-xs font-semibold text-white">
          {officeName}
        </span>
      </div>
      <div className="bg-brand-tint/40 px-3.5 py-4">
        <div className="font-serif text-sm font-semibold text-brand-primary">
          Proclamas e avisos
        </div>
        <div className="mt-2.5 rounded-[9px] border border-brand-border bg-brand-card px-3 py-2.5">
          <div className="text-[10px] font-bold tracking-[0.06em] text-brand-accent uppercase">
            {PUBLICATION_KIND_LABELS[kind]}
            {sector ? ` · ${NOTICE_SECTOR_META[sector].acronym}` : ""}
          </div>
          <div className="mt-1 line-clamp-2 text-xs font-bold text-brand-text">
            {title || "Título da publicação"}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] text-brand-muted">
            {body || "O texto da publicação aparece aqui, como o cidadão lê."}
          </div>
        </div>
      </div>
    </div>
  );
}
