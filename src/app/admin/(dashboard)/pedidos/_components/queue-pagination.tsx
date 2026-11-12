import Link from "next/link";
import { buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import {
  PAGE_GAP,
  pageCount,
  pageWindow,
  type QueueQuery,
  queueHref,
} from "./queue-order.ts";

const BUTTON = buttonVariants({ variant: "outline", size: "icon-sm" });

function Arrow({
  glyph,
  label,
  href,
}: {
  glyph: string;
  label: string;
  /** Where it goes, or nothing when there is no such page. */
  href: string | null;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(BUTTON, "pointer-events-none opacity-50")}
      >
        <span aria-hidden="true">{glyph}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link href={href} scroll={false} className={BUTTON}>
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{label}</span>
    </Link>
  );
}

/**
 * The queue's footer: how much of the tab is on screen and the way to the
 * rest of it. Every control is a link to `?pagina=n`, so the page survives
 * a reload and a copied address. The arrows go grey, not away, at the ends:
 * a row that changes width as the operator pages through it is a row whose
 * buttons keep moving out from under the cursor.
 */
export function QueuePagination({
  query,
  total,
}: {
  /** The current query, with the page already clamped to one that exists. */
  query: QueueQuery;
  total: number;
}) {
  const count = pageCount(total, query.size);
  const start = (query.page - 1) * query.size;
  const end = Math.min(start + query.size, total);
  const range =
    total === 0
      ? "Nenhum registro"
      : `Exibindo ${start + 1} a ${end} de ${total} ${total === 1 ? "pedido" : "pedidos"}`;
  const to = (page: number) => queueHref(query, { page });

  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-muted/50 px-4 py-3">
      <p className="flex-1 text-sm text-muted-foreground tabular-nums">
        {range}
      </p>
      <nav aria-label="Paginação" className="inline-flex items-center gap-1">
        <Arrow
          glyph="«"
          label="Primeira página"
          href={query.page > 1 ? to(1) : null}
        />
        <Arrow
          glyph="‹"
          label="Página anterior"
          href={query.page > 1 ? to(query.page - 1) : null}
        />
        {pageWindow(query.page, count).map((item, index, items) =>
          item === PAGE_GAP ? (
            <span
              // A gap always follows a page number, and never the same one
              // twice, so the number before it names it.
              key={`gap-after-${items[index - 1]}`}
              aria-hidden="true"
              className="inline-flex h-8 w-6 items-center justify-center text-sm text-muted-foreground"
            >
              {PAGE_GAP}
            </span>
          ) : item === query.page ? (
            <span
              key={item}
              aria-current="page"
              className={cn(
                buttonVariants({ size: "icon-sm" }),
                "w-auto min-w-8 px-2 tabular-nums",
              )}
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={to(item)}
              scroll={false}
              className={cn(BUTTON, "w-auto min-w-8 px-2 tabular-nums")}
            >
              {item}
            </Link>
          ),
        )}
        <Arrow
          glyph="›"
          label="Próxima página"
          href={query.page < count ? to(query.page + 1) : null}
        />
        <Arrow
          glyph="»"
          label="Última página"
          href={query.page < count ? to(count) : null}
        />
      </nav>
    </div>
  );
}
