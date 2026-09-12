import Link from "next/link";
import {
  PAGE_GAP,
  pageCount,
  pageWindow,
  type QueueQuery,
  queueHref,
} from "./queue-order.ts";

const BUTTON =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] border text-[13px] transition-colors duration-120";

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
        className={`${BUTTON} w-8 border-admin-border bg-admin-card text-admin-input-border`}
      >
        <span aria-hidden="true">{glyph}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className={`${BUTTON} w-8 border-admin-border bg-admin-card text-admin-primary hover:bg-admin-input-bg`}
    >
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
    <div className="flex flex-wrap items-center gap-3.5 bg-admin-footer-bg px-[22px] py-3.5">
      <p className="flex-1 text-[13px] text-admin-muted">{range}</p>
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
              className="inline-flex h-8 w-6 items-center justify-center text-[13px] text-admin-faint"
            >
              {PAGE_GAP}
            </span>
          ) : item === query.page ? (
            <span
              key={item}
              aria-current="page"
              className={`${BUTTON} border-admin-primary bg-admin-primary px-2 font-bold text-white tabular-nums`}
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={to(item)}
              scroll={false}
              className={`${BUTTON} border-admin-border bg-admin-card px-2 font-bold text-admin-primary tabular-nums hover:bg-admin-input-bg`}
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
