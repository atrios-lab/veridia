import Link from "next/link";
import {
  categoryLabel,
  NEWS_CATEGORIES,
  type PublicNews,
} from "@/core/news/news.ts";
import { publicNewsList } from "@/lib/news.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";

export const generateMetadata = publicMetadata("/noticias");

/** "2026-11-14" as "14/11/2026". */
export const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** The day a post goes by: the event's, else the day it went to the site. */
export const dayOf = (post: PublicNews) =>
  post.eventDate ?? post.publishedAt?.slice(0, 10) ?? null;

function Card({ post }: { post: PublicNews }) {
  const day = dayOf(post);
  const cover = post.photos[0];
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <Link
        href={`/noticias/${post.id}`}
        className="group flex flex-1 flex-col text-left hyphens-none"
      >
        {cover ? (
          // biome-ignore lint/performance/noImgElement: served by its own route, which checks what may be public
          <img
            src={`/noticias/arquivo/${cover}`}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-[16/9] w-full items-center justify-center bg-brand-tint font-serif text-sm font-semibold tracking-wide text-brand-accent-ink"
          >
            {post.categoryLabel}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-brand-accent-soft px-2.5 py-1 font-semibold text-brand-accent-ink">
              {post.categoryLabel}
            </span>
            {day && <span className="text-brand-faint">{brDate(day)}</span>}
          </div>
          <h2 className="font-serif text-lg font-semibold leading-snug text-brand-primary group-hover:underline">
            {post.title}
          </h2>
          <p className="text-left text-sm leading-relaxed text-brand-text-soft hyphens-none">
            {post.summary}
          </p>
          <span className="mt-auto pt-2 text-sm font-semibold text-brand-accent-ink">
            Ler mais
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const tenant = await requireSection("noticias");
  const { tipo } = await searchParams;
  const all = await publicNewsList(tenant.slug);
  // Only the types that have something published are offered as a filter.
  const present = NEWS_CATEGORIES.filter((c) =>
    all.some((post) => post.category === c.id),
  );
  const chosen = present.find((c) => c.id === tipo)?.id;
  const posts = chosen ? all.filter((p) => p.category === chosen) : all;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-10">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        Mural do cartório
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
        Notícias e eventos
      </h1>
      <p className="mt-2 max-w-2xl text-left text-[15px] leading-relaxed text-brand-muted hyphens-none">
        Casamentos comunitários, eventos sociais, correições e outras notícias
        do {tenant.name}. Os editais e proclamas ficam na página de Editais.
      </p>

      {all.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-brand-border bg-brand-surface px-5 py-6 text-sm text-brand-muted">
          Ainda não há notícias publicadas. Para falar com o cartório, use a
          página de contato.
        </p>
      ) : (
        <>
          {present.length > 1 && (
            <nav
              aria-label="Filtrar por tipo"
              className="mt-6 flex flex-wrap gap-2"
            >
              {[{ id: "", label: "Todas" }, ...present].map((c) => {
                const on = (chosen ?? "") === c.id;
                return (
                  <Link
                    key={c.id || "todas"}
                    href={c.id ? `/noticias?tipo=${c.id}` : "/noticias"}
                    aria-current={on ? "page" : undefined}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                      on
                        ? "border-brand-primary bg-brand-primary text-white"
                        : "border-brand-border bg-white text-brand-primary hover:bg-brand-tint"
                    }`}
                  >
                    {c.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} post={post} />
            ))}
          </ul>
          {chosen && (
            <p className="mt-4 text-xs text-brand-faint">
              Mostrando: {categoryLabel(chosen)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
