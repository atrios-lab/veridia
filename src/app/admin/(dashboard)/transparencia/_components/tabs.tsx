"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Two tabs of one module, switched by ?aba= rather than by route, so both
// share the module header. Same shape as the Configurações tabs, minus the
// per-tab permission: the whole module is content.edit, gated once on the page.
const TABS = [
  { label: "Documentos", slug: "documentos" },
  { label: "Boletim mensal", slug: "boletim" },
] as const;

export function TransparencyTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("aba") === "boletim" ? "boletim" : "documentos";

  return (
    <div role="tablist" className="flex gap-6 border-b border-border">
      {TABS.map((tab) => {
        const selected = active === tab.slug;
        return (
          <Link
            key={tab.slug}
            href={`${pathname}?aba=${tab.slug}`}
            role="tab"
            aria-selected={selected}
            className={
              selected
                ? "-mb-px border-b-2 border-primary pb-2.5 text-sm font-medium text-foreground"
                : "-mb-px border-b-2 border-transparent pb-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
