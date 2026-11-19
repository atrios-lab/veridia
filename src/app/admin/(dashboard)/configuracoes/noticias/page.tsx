import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { categoryLabel } from "@/core/news/news.ts";
import { db } from "@/db/index.ts";
import { listNewsWith } from "@/lib/news.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { Badge } from "../../../_ui/badge.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { archiveNewsAction, restoreNewsAction } from "./actions.ts";
import { NewsForm, type PostView } from "./news-forms.tsx";

export const metadata = { title: "Notícias e eventos" };

const PATH = "/admin/configuracoes/noticias";

/** "2026-11-14" as "14/11/2026". */
const brDate = (iso: string) => iso.split("-").reverse().join("/");

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    editar?: string;
    novo?: string;
    arquivadas?: string;
  }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "news.edit", session.user.permissions)
  ) {
    notFound();
  }
  const query = await searchParams;
  const tenant = await getTenant();
  const all = await listNewsWith(db, tenant.slug, { archived: true });
  const active = all.filter((post) => !post.archived);
  const archived = all.filter((post) => post.archived);
  const showArchived = query.arquivadas === "1";
  const editing = query.editar
    ? all.find((post) => post.id === query.editar)
    : undefined;
  const adding = query.novo === "1";
  const viewOf = (post: (typeof all)[number]): PostView => ({
    id: post.id,
    title: post.title,
    category: post.category,
    eventDate: post.eventDate ?? "",
    summary: post.summary,
    body: post.body,
    published: post.published,
    imageConsent: post.imageConsent,
    photos: post.files
      .filter((f) => f.kind === "photo")
      .map((f) => ({ id: f.id, name: f.name })),
    pdf:
      post.files
        .filter((f) => f.kind === "pdf")
        .map((f) => ({ id: f.id, name: f.name }))[0] ?? null,
  });

  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />

        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            Notícias e eventos
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            O mural do cartório: casamentos comunitários, eventos sociais,
            correições e outras notícias para a comunidade. No site, o visitante
            vê só o que você marcar em "Mostrar no site". As fotos só aparecem
            com a autorização de imagem, e o PDF anexado fica público. Para
            proclamas, avisos e editais, use Publicações.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`${PATH}?novo=1`}
              className={buttonVariants({ size: "sm" })}
            >
              + Nova notícia
            </Link>
            <a
              href="/noticias"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver a página do site
            </a>
          </div>
        </section>

        {(adding || editing) && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              {editing ? `Editar: ${editing.title}` : "Nova notícia"}
            </h2>
            <div className="mt-3">
              <NewsForm
                key={editing?.id ?? "nova"}
                post={editing ? viewOf(editing) : undefined}
              />
            </div>
          </section>
        )}

        {active.length === 0 ? (
          <section className="rounded-xl border bg-card px-5 py-6 text-sm text-muted-foreground">
            Nenhuma notícia ainda. Clique em "Nova notícia" para postar o
            primeiro casamento comunitário, evento ou correição.
          </section>
        ) : (
          <section className="rounded-xl border bg-card px-5 py-4">
            <ul className="flex flex-col divide-y">
              {active.map((post) => (
                <li
                  key={post.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
                >
                  <div className="min-w-56 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {post.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        categoryLabel(post.category),
                        post.eventDate ? brDate(post.eventDate) : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      className={
                        post.published
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {post.published ? "No site" : "Rascunho"}
                    </Badge>
                    {post.files.some((f) => f.kind === "photo") && (
                      <Badge className="bg-muted text-foreground">
                        {post.files.filter((f) => f.kind === "photo").length}{" "}
                        fotos
                        {post.imageConsent ? "" : " (sem autorização)"}
                      </Badge>
                    )}
                    {post.files.some((f) => f.kind === "pdf") && (
                      <Badge className="bg-muted text-foreground">PDF</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`${PATH}?editar=${post.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Editar
                    </Link>
                    <form action={archiveNewsAction}>
                      <input type="hidden" name="id" value={post.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Arquivar
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {archived.length > 0 && (
          <section className="rounded-xl border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                Arquivadas ({archived.length})
              </h2>
              <Link
                href={showArchived ? PATH : `${PATH}?arquivadas=1`}
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                {showArchived ? "Esconder" : "Mostrar"}
              </Link>
            </div>
            {showArchived && (
              <ul className="mt-2 flex flex-col divide-y">
                {archived.map((post) => (
                  <li
                    key={post.id}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <span className="min-w-48 flex-1 text-sm text-foreground">
                      {post.title}
                    </span>
                    <form action={restoreNewsAction}>
                      <input type="hidden" name="id" value={post.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Voltar para o mural
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  );
}
