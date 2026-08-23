import type { Theme } from "@/core/tenant/schema.ts";
import { SERIF } from "@/lib/fonts.ts";

/**
 * The home page, redrawn as a phone mockup, reacting live to the draft
 * before anything is published. Not the real home page: an <iframe> of it
 * would need a preview session this repository does not have (see
 * design.md, "A prévia é uma maquete, não a home real"). It answers for
 * style, the two hero texts, the photo and which sections are on: what the
 * tab is actually asking the person to choose.
 *
 * `data-theme` and the serif's own font variable are set only on this box:
 * everything below reads `brand-*` tokens, and nothing outside this box
 * does, which is what keeps the panel itself off the tenant's theme.
 */
export function VisualIdentityPreview({
  theme,
  eyebrow,
  title,
  heroSrc,
  sealLight,
  sealDark,
  officeName,
  sections,
}: {
  theme: Theme;
  eyebrow: string;
  title: string;
  heroSrc: string | undefined;
  sealLight: string;
  sealDark: string;
  officeName: string;
  sections: string[];
}) {
  return (
    <div
      data-theme={theme}
      className={`${SERIF[theme].variable} overflow-hidden rounded-[28px] border border-admin-border bg-brand-surface shadow-[0_14px_34px_rgb(9_24_16/0.14)]`}
    >
      <div className="flex items-center justify-between border-b border-brand-border px-4.5 py-3">
        <div className="flex items-center gap-2">
          {/* The seal is institutional, not editable here (same image the
              header of the real site uses). */}
          {/** biome-ignore lint/performance/noImgElement: preview shows a
              locally chosen, unpublished file via an object URL; next/image
              cannot optimize a blob: source. */}
          <img
            src={sealLight}
            alt=""
            className="h-[22px] w-[22px] object-contain"
          />
          <span className="font-serif text-[11px] font-bold text-brand-primary">
            {officeName}
          </span>
        </div>
      </div>

      <div className="hero-scrim relative overflow-hidden px-4.5 pt-7.5 pb-5">
        {heroSrc && (
          // biome-ignore lint/performance/noImgElement: see note above.
          <img
            src={heroSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="hero-scrim absolute inset-0" />
        <div className="relative">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-on-dark-accent">
            {eyebrow || " "}
          </span>
          {/* Same uppercase as the live hero, or the office edits the title
              here and the site renders it differently. */}
          <h1 className="mt-1.5 font-serif text-[25px] font-semibold uppercase leading-tight text-brand-on-dark-heading">
            {title || " "}
          </h1>
          <div className="mt-3.5 flex gap-1.5 rounded-xl bg-brand-card p-1.5">
            <div className="flex-1 px-2 py-2 text-[12.5px] text-brand-faint">
              Nº do protocolo
            </div>
            <div className="rounded-lg bg-brand-primary px-3.5 py-2.5 text-[12.5px] font-semibold text-white">
              Consultar
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-3.5 py-4">
        {sections.slice(0, 2).map((label) => (
          <div
            key={label}
            className="flex items-center gap-2.5 rounded-[13px] border border-brand-border bg-brand-card px-3.5 py-3"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-brand-tint" />
            <span className="font-serif text-[14.5px] font-semibold text-brand-primary">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-brand-primary px-4 py-3">
        {/* biome-ignore lint/performance/noImgElement: see note above. */}
        <img
          src={sealDark}
          alt=""
          className="h-[18px] w-[18px] object-contain"
        />
        <span className="font-serif text-[12px] font-semibold text-white">
          {officeName}
        </span>
      </div>
    </div>
  );
}
