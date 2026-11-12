"use client";

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button } from "../../../_ui/button.tsx";

/**
 * A row of cards that scrolls sideways, CSS scroll-snap and nothing else:
 * the trackpad, the wheel with Shift, a swipe and Tab through the cards all
 * work with no script at all. The script is only the two arrows, which
 * page by the visible width and grey out at either end, and hide when
 * everything already fits.
 *
 * The cards come in as children, rendered on the server. The one playing
 * above (`aria-current`) is scrolled into view when it changes, so the
 * shelf never opens with the current video hidden past the edge.
 */
export function TutorialShelf({
  title,
  count,
  subtitle,
  currentId,
  children,
}: {
  title: string;
  /** "3" or "2 de 5", next to the title. */
  count: string;
  subtitle: string;
  /** The featured video's id, to bring its card into view. */
  currentId?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    // A pixel of slack: fractional widths leave scrollLeft just short of
    // the end on some zoom levels.
    setEdges({
      start: list.scrollLeft <= 1,
      end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  // Sideways only: scrollIntoView would also scroll the page down to the
  // shelf, away from the player the person just chose.
  useEffect(() => {
    if (!currentId) return;
    const list = listRef.current;
    const card = list?.querySelector('[aria-current="true"]');
    if (!list || !card) return;
    const listBox = list.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    if (cardBox.left >= listBox.left && cardBox.right <= listBox.right) return;
    list.scrollLeft += cardBox.left - listBox.left - 4;
  }, [currentId]);

  function page(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * list.clientWidth * 0.9,
      behavior: "smooth",
    });
  }

  const fits = edges.start && edges.end;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="flex items-baseline gap-2 text-lg leading-tight font-semibold text-foreground"
          >
            {title}
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">
              {count}
            </span>
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {!fits && (
          <div className="flex flex-none items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => page(-1)}
              disabled={edges.start}
              aria-label={`Voltar em ${title}`}
            >
              <AdminIcon name="chevronDown" className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => page(1)}
              disabled={edges.end}
              aria-label={`Avançar em ${title}`}
            >
              <AdminIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
            </Button>
          </div>
        )}
      </div>
      <ul
        ref={listRef}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto px-1 pt-1 pb-3 [scrollbar-width:thin]"
      >
        {Children.map(children, (child) => (
          // The last card snaps by its end: the farthest the list scrolls
          // is short of where its start would snap, and without an end
          // position mandatory snapping pulls a focused last card back
          // out of view.
          <li className="w-[260px] flex-none snap-start last:snap-end sm:w-[284px]">
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
