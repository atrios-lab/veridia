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
  /**
   * Marks a destination outside the application: a tool the office already
   * uses, not a panel route. The sidebar opens these in a named tab and
   * signals the exit; nothing here ever matches `pathname`, so an external
   * item is never the current page.
   */
  external?: true;
  /**
   * An entry point the office should not miss: the sidebar draws it in the
   * solid, pulsing "click here" treatment (see attention.ts) until the person
   * is on that screen. Kept for what the office is being asked to go and
   * do, like the training; spent on everything, it stops meaning anything.
   */
  attention?: true;
}

/**
 * The sidebar, as data.
 *
 * Only routes that exist in the application are listed: a menu entry that
 * leads to a 404 spends more of the registrar's trust than a short sidebar
 * saves. Each delivery adds its own line here when its screen lands: the
 * approved design's nine items across three groups are all here now.
 *
 * An item marked `external` is the one exception to "routes of this
 * application", never to the rule behind it: it points at a tool the office
 * works in every day, so it leads somewhere real just the same.
 *
 * Order is meaningful beyond appearance: `navGroups` below closes a group the
 * moment the next item names a different one, so an item separated from its
 * own group opens a second heading with the same name.
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
    permission: "desk.access",
  },
  {
    group: "Operação",
    label: "Pedidos de serviço",
    href: "/admin/pedidos",
    icon: "inbox",
    permission: "requests.manage",
  },
  {
    group: "Operação",
    label: "Email corporativo",
    // The office's institutional mailbox. One address for every serventia
    // while they all share it: a tenant field for a value that never varies
    // is configuration with nothing to configure. Authentication happens
    // entirely at Zoho; the panel only points the way.
    href: "https://mail.zoho.com/zm/#mail/folder/inbox",
    icon: "mail",
    external: true,
    permission: "desk.access",
  },
  {
    group: "Operação",
    label: "Mensagens",
    href: "/admin/mensagens",
    icon: "chat",
    permission: "desk.access",
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
    // Tools for the deed desk. The first: the guias de recolhimento (ITIV,
    // ITCD, laudêmio, certidão imobiliária) the notary signs and the party
    // takes to the fisco before the escritura.
    group: "Utilitários",
    label: "Guias de recolhimento",
    href: "/admin/utilitarios/guias",
    icon: "calculator",
    permission: "requests.manage",
  },
  {
    // PAdES signatures with the office's A1 certificates (ICP-Brasil), each
    // with its verification code and QR (see lib/signing.ts).
    group: "Utilitários",
    label: "Assinador digital",
    href: "/admin/utilitarios/assinador",
    icon: "lock",
    permission: "desk.access",
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
    label: "Adequação ao Provimento",
    href: "/admin/adequacao",
    icon: "clipboard",
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
  {
    // Everyone of the office: the Tabelião/Registrador sees the whole trail
    // and the notifications; anyone else, only the notifications addressed
    // to them (lib/audit-trail.ts).
    group: "Serventia",
    label: "Auditoria",
    href: "/admin/auditoria",
    icon: "clipboard",
  },
  {
    // The Átrios master account only (a platform permission): turning the
    // two-step access off or on for any office (lib/access-policy.ts).
    group: "Átrios",
    label: "Liberação de acesso",
    href: "/admin/atrios/liberacao-de-acesso",
    icon: "shield",
    permission: "access.release",
  },
  {
    // The platform's video tutorials: no permission, every panel user may
    // watch. The sidebar still omits it while the catalog is empty (see
    // sidebar.tsx), the one case where the route exists and the item does
    // not: a screen that only says "estamos preparando" is a link to
    // nowhere until the first video lands. It pulses: the office was
    // asked to watch the videos, and an item at the foot of the column went
    // unnoticed.
    group: "Ajuda",
    label: "Treinamento",
    href: "/admin/ajuda",
    icon: "play",
    attention: true,
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
