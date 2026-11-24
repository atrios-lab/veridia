"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
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
        label: "Equipe do cartório",
        href: "/admin/configuracoes/equipe",
        permission: "team.edit",
      },
      {
        label: "Notícias e eventos",
        href: "/admin/configuracoes/noticias",
        permission: "news.edit",
      },
      {
        label: "Assistente Virtual",
        href: "/admin/configuracoes/assistente-virtual",
        permission: "user.manage",
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
  {
    // The internal routing of the pedidos (change
    // direcionamento-interno-de-pedidos).
    label: "Direcionamento",
    tabs: [
      {
        label: "Setores",
        href: "/admin/configuracoes/setores",
        permission: "routing.settings",
      },
      {
        label: "Assinatura e conclusão",
        href: "/admin/configuracoes/assinatura-e-conclusao",
        permission: "routing.settings",
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

  // The group first, then its pages (redesign of 11/11/2026; the pages'
  // row laid out in columns on 19/11/2026).
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
      {/* On a phone, one line that scrolls sideways (its bar hidden). From
          the tablet up, the tabs share the width in even columns, at most
          four to a row, each over its own stretch of the rule: a group with
          eight tabs reads as two tidy rows instead of a strip that scrolls. */}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <ul
          className="flex min-w-max gap-6 border-b md:grid md:min-w-0 md:grid-cols-[repeat(var(--tab-columns),minmax(0,1fr))] md:gap-0 md:border-b-0"
          style={
            {
              "--tab-columns": Math.min(current.tabs.length, 4),
            } as CSSProperties
          }
        >
          {current.tabs.map((tab) => {
            const selected = tab.href === pathname;
            return (
              <li key={tab.href} className="md:border-b">
                <Link
                  href={tab.href}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors md:truncate md:px-3 md:pt-2 md:text-center md:hover:bg-muted/50",
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
