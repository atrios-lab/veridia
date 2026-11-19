import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/index.ts";
import { publicNewsOneWith } from "@/lib/news.ts";
import { requireSection } from "../../_lib/section.ts";

/** "2026-11-14" as "14/11/2026". */
const brDate = (iso: string) => iso.split("-").reverse().join("/");

async function load(id: string) {
  const tenant = await requireSection("noticias");
  const post = await publicNewsOneWith(db, tenant.slug, id).catch(() => null);
  return { tenant, post };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { post } = await load(id);
  if (!post) return { title: "Notícia não encontrada" };
  return { title: post.title, description: post.summary };
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { post } = await load(id);
  if (!post) notFound();
  const day = post.eventDate ?? post.publishedAt?.slice(0, 10) ?? null;
  const paragraphs = post.body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-10">
      <Link
        href="/noticias"
        className="text-sm font-semibold text-brand-accent-ink underline underline-offset-4"
      >
        ← Todas as notícias
      </Link>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-lg bg-brand-accent-soft px-2.5 py-1 font-semibold text-brand-accent-ink">
          {post.categoryLabel}
        </span>
        {day && <span className="text-brand-faint">{brDate(day)}</span>}
      </div>
      <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-brand-primary">
        {post.title}
      </h1>
      <p className="mt-3 text-left text-[17px] leading-relaxed text-brand-text-soft hyphens-none">
        {post.summary}
      </p>
      {paragraphs.map((text) => (
        <p
          key={text}
          className="mt-4 whitespace-pre-line text-left leading-relaxed text-brand-text-soft [overflow-wrap:anywhere] hyphens-none"
        >
          {text}
        </p>
      ))}
      {post.photos.length > 0 && (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {post.photos.map((photo, index) => (
            <li key={photo}>
              {/* biome-ignore lint/performance/noImgElement: served by its own route, which checks what may be public */}
              <img
                src={`/noticias/arquivo/${photo}`}
                alt={`Foto ${index + 1} de ${post.title}`}
                loading="lazy"
                className="w-full rounded-xl border border-brand-border object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      {post.pdf && (
        <p className="mt-8">
          <a
            href={`/noticias/arquivo/${post.pdf.id}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary hover:bg-brand-tint"
          >
            Abrir o PDF: {post.pdf.name}
          </a>
        </p>
      )}
    </article>
  );
}
