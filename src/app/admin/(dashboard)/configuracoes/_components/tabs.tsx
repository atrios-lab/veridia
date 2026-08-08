"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";

// The four tabs of the approved design, now all with a screen.
//
// `permission` only decides what is *offered*, same courtesy-not-gate rule
// as the sidebar (see admin/_components/nav.ts): the route behind each link
// re-checks on the server regardless.
const TABS: {
  label: string;
  href: string;
  permission: Permission;
}[] = [
  {
    label: "Serventia",
    href: "/admin/configuracoes",
    permission: "content.edit",
  },
  {
    label: "Identidade Visual",
    href: "/admin/configuracoes/identidade-visual",
    permission: "branding.edit",
  },
  {
    label: "Encarregado",
    href: "/admin/configuracoes/encarregado",
    permission: "content.edit",
  },
  {
    label: "Cobrança",
    href: "/admin/configuracoes/cobranca",
    permission: "content.edit",
  },
];

export function ConfiguracoesTabs({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      className="flex w-fit gap-1.5 rounded-[11px] border border-admin-border bg-admin-card p-1.5"
    >
      {TABS.map((tab) => {
        const offered = can(role, tab.permission);
        const selected = pathname === tab.href;
        return offered ? (
          <Link
            key={tab.label}
            href={tab.href}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            className={
              selected
                ? "rounded-lg bg-admin-primary px-4 py-2 text-[13px] font-bold text-white"
                : "rounded-lg px-4 py-2 text-[13px] font-semibold text-admin-muted hover:text-admin-primary"
            }
          >
            {tab.label}
          </Link>
        ) : (
          <span
            key={tab.label}
            role="tab"
            aria-disabled="true"
            aria-selected={false}
            tabIndex={-1}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-admin-faint"
          >
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}
