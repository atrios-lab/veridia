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

/**
 * A row of cards that scrolls sideways, CSS scroll-snap and nothing else:
 * the trackpad, the wheel with Shift, a swipe and Tab through the cards all
 * work with no script at all. The script is only the two arrows, which
 * page by the visible width and grey out at either end, and hide when
 * everything already fits.
 *
 * The cards come in as children, rendered on the server.
 */
export function TutorialShelf({
  title,
  count,
  subtitle,
  children,
}: {
  title: string;
  /** "3" or "2 de 5", next to the title. */
  count: string;
  subtitle: string;
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
            className="flex items-baseline gap-2 font-serif text-[18px] leading-tight font-semibold text-admin-primary"
          >
            {title}
            <span className="font-sans text-[13px] font-semibold text-admin-faint tabular-nums">
              {count}
            </span>
          </h2>
          <p className="mt-0.5 text-[13px] text-admin-muted">{subtitle}</p>
        </div>
        {!fits && (
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={edges.start}
              aria-label={`Voltar em ${title}`}
              className="btn btn-admin-ghost btn-sm px-2"
            >
              <AdminIcon name="chevronDown" className="h-4 w-4 rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={edges.end}
              aria-label={`Avançar em ${title}`}
              className="btn btn-admin-ghost btn-sm px-2"
            >
              <AdminIcon name="chevronDown" className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        )}
      </div>
      <ul
        ref={listRef}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto px-1 pt-1 pb-3 [scrollbar-width:thin]"
      >
        {Children.map(children, (child) => (
          <li className="w-[260px] flex-none snap-start sm:w-[284px]">
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
