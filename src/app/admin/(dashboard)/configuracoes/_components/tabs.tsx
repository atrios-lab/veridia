"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { can, type Permission } from "@/core/auth/roles.ts";
import { AdminIcon } from "../../../_components/icon.tsx";

// The settings, in three groups (decision of 11/11/2026): nine tabs in one
// wrapping row read as clutter, three rows deep on a phone. The group is
// chosen first, then the page; on a phone a single menu holds them all.
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
        permission: "content.edit",
      },
      {
        label: "Certificados digitais",
        href: "/admin/configuracoes/certificados",
        permission: "user.manage",
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
        permission: "user.manage",
      },
      {
        label: "Horário de acesso",
        href: "/admin/configuracoes/horario-de-acesso",
        permission: "user.manage",
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
  const page = current?.tabs.find((tab) => tab.href === pathname);
  if (!current) return null;

  return (
    <nav aria-label="Seções de configurações">
      <PhoneMenu groups={groups} pathname={pathname} page={page} />

      <div className="hidden md:block">
        {groups.length > 1 && (
          <div className="inline-flex rounded-[10px] bg-admin-card p-1 ring-1 ring-admin-border">
            {groups.map((group) => {
              const active = group === current;
              return (
                <Link
                  key={group.label}
                  href={group.tabs[0].href}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${active ? "bg-admin-primary text-white" : "text-admin-muted hover:text-admin-primary"}`}
                >
                  {group.label}
                </Link>
              );
            })}
          </div>
        )}
        <ul className="mt-3 flex gap-6 border-b border-admin-border">
          {current.tabs.map((tab) => {
            const selected = tab.href === pathname;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={selected ? "page" : undefined}
                  className={`-mb-px block whitespace-nowrap border-b-2 pb-2.5 text-[13.5px] transition-colors ${selected ? "border-admin-primary font-bold text-admin-primary" : "border-transparent font-semibold text-admin-muted hover:text-admin-primary"}`}
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

/** On a phone: one button with where you are, and the full list on tap. */
function PhoneMenu({
  groups,
  pathname,
  page,
}: {
  groups: { label: string; tabs: Tab[] }[];
  pathname: string;
  page: Tab | undefined;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes on every navigation
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={box} className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="configuracoes-secoes"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-[12px] border border-admin-border bg-admin-card px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-admin-muted">
            Seção
          </span>
          <span className="block truncate text-[15px] font-semibold text-admin-primary">
            {page?.label ?? "Escolha"}
          </span>
        </span>
        <AdminIcon
          name="chevronDown"
          className={`h-5 w-5 shrink-0 text-admin-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          id="configuracoes-secoes"
          className="absolute inset-x-0 top-full z-30 mt-2 rounded-[12px] border border-admin-border bg-admin-card py-2 shadow-lg"
        >
          {groups.map((group) => (
            <div key={group.label} className="px-2 py-1">
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-admin-muted">
                {group.label}
              </p>
              <ul>
                {group.tabs.map((tab) => {
                  const selected = tab.href === pathname;
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={selected ? "page" : undefined}
                        className={`flex items-center justify-between rounded-[8px] px-2.5 py-2.5 text-[14.5px] ${selected ? "bg-admin-input-bg font-bold text-admin-primary" : "font-medium text-admin-text hover:bg-admin-input-bg"}`}
                      >
                        {tab.label}
                        {selected && (
                          <AdminIcon name="check" className="h-4 w-4" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
