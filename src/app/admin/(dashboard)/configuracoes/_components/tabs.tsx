"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission } from "@/core/auth/roles.ts";
import { cn } from "../../../_ui/cn.ts";

// The settings, in three groups (decision of 11/11/2026): nine tabs in one
// wrapping row read as clutter, three rows deep on a phone. The group is
// chosen first, then the page.
//
// `permission` only decides what is *offered*, same courtesy-not-gate rule
// as the sidebar (see admin/_components/nav.ts): the route behind each link
// re-checks on the server regardless. What is not offered is not shown.
interface Tab {
  label: string;
  href: string;
  permission: Permission;
}

const GROUPS: { label: string; tabs: Tab[] }[] = [
  {
    label: "Serventia",
    tabs: [
      {
        label: "Dados gerais",
        href: "/admin/configuracoes",
        permission: "content.edit",
      },
      {
        label: "Identidade visual",
        href: "/admin/configuracoes/identidade-visual",
        permission: "branding.edit",
      },
      {
        label: "Encarregado (LGPD)",
        href: "/admin/configuracoes/encarregado",
        permission: "content.edit",
      },
      {
        label: "Cobrança",
        href: "/admin/configuracoes/cobranca",
        permission: "content.edit",
      },
      {
        label: "Notificações",
        href: "/admin/configuracoes/notificacoes",
        permission: "content.edit",
      },
    ],
  },
  {
    label: "Documentos",
    tabs: [
      {
        label: "Numeração",
        href: "/admin/configuracoes/numeracao",
        permission: "numbering.manage",
      },
      {
        label: "Quem assina",
        href: "/admin/configuracoes/quem-assina",
        permission: "content.edit",
      },
      {
        label: "Certificados digitais",
        href: "/admin/configuracoes/certificados",
        permission: "certificates.manage",
      },
    ],
  },
  {
    label: "Equipe e acesso",
    tabs: [
      {
        label: "Perfis e permissões",
        href: "/admin/configuracoes/perfis",
        permission: "user.manage",
      },
      {
        label: "Duas etapas",
        href: "/admin/configuracoes/duas-etapas",
        permission: "access.manage",
      },
      {
        label: "Horário de acesso",
        href: "/admin/configuracoes/horario-de-acesso",
        permission: "access.manage",
      },
    ],
  },
];

export function ConfiguracoesTabs({
  role,
  permissions,
}: {
  role: string;
  /** The session's effective permissions (the Tabelião's choices). */
  permissions?: readonly string[];
}) {
  const pathname = usePathname();
  const groups = GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => can(role, tab.permission, permissions)),
  })).filter((group) => group.tabs.length > 0);
  const current =
    groups.find((group) => group.tabs.some((tab) => tab.href === pathname)) ??
    groups[0];
  if (!current) return null;

  // One strip at every width: on a phone it scrolls sideways instead of
  // wrapping, the same as the line tabs everywhere else in the panel
  // (redesign of 11/11/2026).
  return (
    <nav aria-label="Seções de configurações">
      {groups.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {groups.map((group) => {
              const active = group === current;
              return (
                <Link
                  key={group.label}
                  href={group.tabs[0].href}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {group.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-6 border-b">
          {current.tabs.map((tab) => {
            const selected = tab.href === pathname;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                    selected
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
