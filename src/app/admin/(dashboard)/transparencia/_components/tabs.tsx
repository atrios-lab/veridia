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
    <div role="tablist" className="flex gap-6 border-b border-admin-border">
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
                ? "-mb-px border-b-2 border-admin-primary pb-2.5 text-[13.5px] font-bold text-admin-primary"
                : "-mb-px border-b-2 border-transparent pb-2.5 text-[13.5px] font-semibold text-admin-muted hover:text-admin-primary"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
