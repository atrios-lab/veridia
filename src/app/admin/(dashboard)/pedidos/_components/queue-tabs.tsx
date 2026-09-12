import Link from "next/link";
import {
  QUEUE_TABS,
  type QueueQuery,
  type QueueTabId,
  queueHref,
} from "./queue-order.ts";
import { toneClass } from "./status-tone.ts";

/**
 * One tab per andamento, each with how many protocols it holds. Links, not
 * buttons: the tab is the `aba` parameter of the URL, so the address bar,
 * the back button and a bookmark all agree on which tab is open. The
 * counter of the active tab wears the tone of its andamento; the others
 * stay neutral so the row of numbers does not read as a traffic light.
 *
 * One line, always, and never a scrollbar: a second row of tabs reads as a
 * second set of choices, and a row that scrolls hides the tab that matters
 * most, Finalizados, off the right edge. The tabs share the row's width
 * equally, so on a wide screen they spread across the card instead of
 * huddling at the left. Below 1120px of card (a 1366px laptop, or a wide
 * screen zoomed in) the four long labels switch to their short form, which
 * leaves real slack instead of fitting to the pixel. The short row is 907px
 * of content, which a 1210px viewport gives the card; narrower than that (a
 * tablet, a phone) the tabs wrap, since clipping one is worse than a second
 * line.
 */
export function QueueTabs({
  query,
  counts,
}: {
  query: QueueQuery;
  counts: Record<QueueTabId, number>;
}) {
  return (
    <nav
      aria-label="Andamentos"
      className="flex flex-wrap items-stretch border-b border-admin-border px-3 @container min-[1210px]:flex-nowrap"
    >
      {QUEUE_TABS.map((tab) => {
        const active = tab.id === query.tab;
        return (
          <Link
            key={tab.id}
            href={queueHref(query, { tab: tab.id })}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex flex-1 items-center justify-center gap-1.5 border-b-[3px] px-1.5 pt-[15px] pb-3 text-[13px] whitespace-nowrap transition-colors duration-120 ${
              active
                ? "border-admin-primary-soft font-bold text-admin-primary"
                : "border-transparent font-medium text-admin-muted hover:text-admin-primary"
            }`}
          >
            {tab.shortLabel ? (
              <>
                <span className="@max-[1120px]:hidden">{tab.label}</span>
                <span className="hidden @max-[1120px]:inline">
                  {tab.shortLabel}
                </span>
              </>
            ) : (
              tab.label
            )}
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] px-1.5 text-[11px] font-bold tabular-nums ${
                active
                  ? toneClass(tab.tone)
                  : "bg-admin-readonly-bg text-admin-muted"
              }`}
            >
              {counts[tab.id] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
