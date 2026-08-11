import type { Permission } from "@/core/auth/roles.ts";
import type { AdminIconName } from "./icon.tsx";

export interface AdminNavItem {
  /** Section heading the item sits under in the sidebar. */
  group: string;
  label: string;
  href: string;
  icon: AdminIconName;
  /** Absent means every panel user sees it. */
  permission?: Permission;
}

/**
 * The sidebar, as data.
 *
 * Only routes that exist in the application are listed: a menu entry that
 * leads to a 404 spends more of the registrar's trust than a short sidebar
 * saves. Each delivery adds its own line here when its screen lands — the
 * approved design's nine items across three groups are all here now.
 *
 * The permission field only decides what is *offered*. Hiding a link is a
 * courtesy, never the access check: the route behind it checks for itself.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    group: "Operação",
    label: "Visão geral",
    href: "/admin",
    icon: "grid",
  },
  {
    group: "Operação",
    label: "Pedidos de serviço",
    href: "/admin/pedidos",
    icon: "inbox",
    permission: "requests.manage",
  },
  {
    group: "Canais do cidadão",
    label: "Requerimentos LGPD",
    href: "/admin/lgpd",
    icon: "shield",
    permission: "channels.manage",
  },
  {
    group: "Canais do cidadão",
    label: "Ouvidoria",
    href: "/admin/ouvidoria",
    icon: "megaphone",
    permission: "channels.manage",
  },
  {
    group: "Canais do cidadão",
    label: "Agenda de atendimentos",
    href: "/admin/agenda",
    icon: "calendar",
    permission: "channels.manage",
  },
  {
    group: "Canais do cidadão",
    label: "Atendimento online",
    href: "/admin/atendimento",
    icon: "chat",
    permission: "chat.manage",
  },
  {
    group: "Serventia",
    label: "Publicações",
    href: "/admin/publicacoes",
    icon: "file",
    permission: "content.edit",
  },
  {
    group: "Serventia",
    label: "Transparência",
    href: "/admin/transparencia",
    icon: "globe",
    permission: "content.edit",
  },
  {
    group: "Serventia",
    label: "Configurações",
    href: "/admin/configuracoes",
    icon: "settings",
    permission: "content.edit",
  },
  {
    group: "Serventia",
    label: "Usuários",
    href: "/admin/usuarios",
    icon: "users",
    permission: "user.manage",
  },
];

/** The groups in display order, with the items each one keeps. */
export function navGroups(
  items: readonly AdminNavItem[],
): { group: string; items: AdminNavItem[] }[] {
  const groups: { group: string; items: AdminNavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}
