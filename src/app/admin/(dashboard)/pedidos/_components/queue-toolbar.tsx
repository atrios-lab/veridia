import Link from "next/link";
import { ATTRIBUTION_ACRONYMS } from "@/core/acts/catalog.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import { Dropdown } from "../../../_components/dropdown.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  QUEUE_PATH,
  type QueueQuery,
  queueHref,
} from "./queue-order.ts";

/**
 * Page size, attribution filter and search, all within the current tab.
 * The two dropdowns are menus of links (see dropdown.tsx); the search is a
 * plain GET form that carries the tab, the filter and the page size along
 * as hidden fields and leaves the page out, so a new search starts at page
 * 1. "Limpar" only shows when there is something to clear.
 */
export function QueueToolbar({
  query,
  attributions,
}: {
  query: QueueQuery;
  /** The office's own attributions: the only ones worth filtering by. */
  attributions: readonly Attribution[];
}) {
  const hasFilters = Boolean(query.attribution || query.search);

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-admin-border px-[22px] py-4">
      <span className="inline-flex items-center gap-2 text-[13px] text-admin-muted">
        Exibir
        <Dropdown
          label={String(query.size)}
          value={String(query.size)}
          options={PAGE_SIZES.map((size) => ({
            value: String(size),
            label: String(size),
            href: queueHref(query, { size }),
          }))}
          triggerClassName="gap-2 py-2 pr-2.5 pl-3"
          menuClassName="min-w-[96px]"
        />
        por página
      </span>
      <span className="min-w-4 flex-1" />
      <Dropdown
        label={
          query.attribution
            ? `Atribuição: ${ATTRIBUTION_ACRONYMS[query.attribution]}`
            : "Atribuição: todas"
        }
        value={query.attribution ?? ""}
        options={[
          {
            value: "",
            label: "Atribuição: todas",
            href: queueHref(query, { attribution: undefined }),
          },
          ...attributions.map((attribution) => ({
            value: attribution,
            label: ATTRIBUTION_ACRONYMS[attribution],
            href: queueHref(query, { attribution }),
          })),
        ]}
        triggerClassName="py-[9px] pr-2.5 pl-3"
        menuClassName="min-w-[200px]"
      />
      <form
        method="get"
        action={QUEUE_PATH}
        aria-label="Buscar nesta aba"
        className="relative flex min-w-[260px] flex-1 items-center md:max-w-[420px]"
      >
        {query.tab !== "new" && (
          <input type="hidden" name="aba" value={query.tab} />
        )}
        {query.attribution && (
          <input type="hidden" name="atribuicao" value={query.attribution} />
        )}
        {query.size !== DEFAULT_PAGE_SIZE && (
          <input type="hidden" name="por" value={query.size} />
        )}
        <AdminIcon
          name="search"
          strokeWidth={2}
          className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-admin-faint"
        />
        <input
          type="search"
          name="q"
          defaultValue={query.search ?? ""}
          placeholder="Buscar protocolo ou nome"
          aria-label="Buscar protocolo ou nome"
          className="w-full rounded-[9px] border border-admin-input-border bg-admin-card py-2.5 pr-3 pl-[34px] text-[13px] text-admin-text transition-colors duration-120 placeholder:text-admin-faint focus:border-admin-primary-soft focus:outline-none"
        />
      </form>
      {hasFilters && (
        <Link
          href={queueHref(query, { attribution: undefined, search: undefined })}
          scroll={false}
          className="px-0.5 py-1.5 text-[12.5px] font-semibold text-admin-primary-soft underline underline-offset-2 hover:text-admin-primary"
        >
          Limpar
        </Link>
      )}
    </div>
  );
}
