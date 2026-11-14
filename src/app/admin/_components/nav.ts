import type { Permission } from "@/core/auth/roles.ts";
import type { AdminIconName } from "./icon.tsx";

/**
 * A screen inside an item, drawn as shadcn's collapsible sub-menu (the item
 * folds, its screens hang from a guide line). Only the tools of Utilitários
 * use it so far: each is a small module with its own list, form and
 * configuration, and the person reached those only through the buttons of
 * the tool's first screen.
 */
export interface AdminNavSubItem {
  label: string;
  href: string;
  /** Absent means whoever sees the parent item sees this one too. */
  permission?: Permission;
}

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
  /**
   * The item's own screens. With these the item becomes a fold: it opens
   * the list instead of leading anywhere, so the first entry must be the
   * item's own `href`, or the tool's main screen would have no way in.
   */
  children?: readonly AdminNavSubItem[];
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
    label: "Mensagens internas",
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
    // The office's attributions (decision of 14/11/2026): one entry per
    // specialty, each where its files are loaded and its acts worked. The
    // first is the Registro Civil (change consulta-de-registro-rcpn); the
    // others (Imóveis, Títulos e Documentos, Pessoas Jurídicas, Protesto,
    // Distribuição, Notas) and the Caixa have their guide (books, indexes
    // and deadlines of the law, core/attributions/guides.ts) and link to
    // what the panel already does for them.
    group: "Atribuições",
    label: "Registro Civil",
    href: "/admin/rcpn",
    icon: "file",
    permission: "rcpn.search",
    children: [
      { label: "Pesquisar no índice", href: "/admin/rcpn" },
      {
        label: "Certidões",
        href: "/admin/rcpn/certidoes",
        permission: "rcpn.certidao",
      },
      {
        label: "Importar arquivos",
        href: "/admin/rcpn/importar",
        permission: "rcpn.import",
      },
      {
        label: "Guia: livros e prazos",
        href: "/admin/atribuicoes/registro-civil",
        permission: "attributions.view",
      },
    ],
  },
  {
    group: "Atribuições",
    label: "Registro de Imóveis",
    href: "/admin/atribuicoes/registro-de-imoveis",
    icon: "house",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Títulos e Documentos",
    href: "/admin/atribuicoes/titulos-e-documentos",
    icon: "files",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Pessoas Jurídicas",
    href: "/admin/atribuicoes/pessoas-juridicas",
    icon: "building",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Protesto",
    href: "/admin/atribuicoes/protesto",
    icon: "gavel",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Distribuição",
    href: "/admin/atribuicoes/distribuicao",
    icon: "shuffle",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Notas",
    href: "/admin/atribuicoes/notas",
    icon: "signature",
    permission: "attributions.view",
  },
  {
    group: "Atribuições",
    label: "Caixa",
    href: "/admin/atribuicoes/caixa",
    icon: "wallet",
    permission: "attributions.view",
  },
  {
    // Tools for the deed desk. The first: the guias de transmissão de bens (ITIV,
    // ITCD, laudêmio, certidão imobiliária) the notary signs and the party
    // takes to the fisco before the escritura.
    group: "Utilitários",
    label: "Guias de transmissão",
    href: "/admin/utilitarios/guias",
    icon: "calculator",
    permission: "guides.manage",
    children: [
      { label: "Guias emitidas", href: "/admin/utilitarios/guias" },
      { label: "Nova guia", href: "/admin/utilitarios/guias/nova" },
      {
        label: "Leis e alíquotas",
        href: "/admin/utilitarios/guias/configuracao",
        permission: "content.edit",
      },
    ],
  },
  {
    // The month's ISS on the emolumentos to the municipal tax office, with
    // the book attached (decision of 11/11/2026).
    group: "Utilitários",
    label: "Declaração de ISS",
    href: "/admin/utilitarios/iss",
    icon: "clipboard",
    permission: "iss.manage",
    children: [
      { label: "Declarações", href: "/admin/utilitarios/iss" },
      { label: "Nova declaração", href: "/admin/utilitarios/iss/nova" },
      {
        label: "Configuração",
        href: "/admin/utilitarios/iss/configuracao",
        permission: "content.edit",
      },
    ],
  },
  {
    // The Livro Diário Auxiliar da Receita e da Despesa (decision of
    // 11/11/2026): the productivity report read act by act, the expenses
    // with their receipts, the day's and the month's pages, the year.
    group: "Utilitários",
    label: "Livro Diário Auxiliar",
    href: "/admin/utilitarios/livro-diario",
    icon: "grid",
    permission: "daily-book.manage",
    children: [
      { label: "Visão do livro", href: "/admin/utilitarios/livro-diario" },
      {
        label: "Lançamento",
        href: "/admin/utilitarios/livro-diario/lancamento",
      },
      {
        label: "Anexar produtividade",
        href: "/admin/utilitarios/livro-diario/importar",
      },
      {
        label: "Excedente do interino",
        href: "/admin/utilitarios/livro-diario/excedente",
      },
      {
        label: "Justiça Aberta",
        href: "/admin/utilitarios/livro-diario/justica-aberta",
      },
      {
        label: "Configuração",
        href: "/admin/utilitarios/livro-diario/configuracao",
      },
    ],
  },
  {
    // Papel de segurança (decision of 11/11/2026): the classificador of the
    // lots, their use and losses, and the ofícios to the Corregedoria
    // (Provimento CGJ/RN 156/2016, arts. 59 and 60).
    group: "Utilitários",
    label: "Papel de segurança",
    href: "/admin/utilitarios/papel-seguranca",
    icon: "shield",
    permission: "security-paper.manage",
    children: [
      { label: "Estoque e lotes", href: "/admin/utilitarios/papel-seguranca" },
      {
        label: "Cadastrar lote",
        href: "/admin/utilitarios/papel-seguranca/novo-lote",
      },
      {
        label: "Lançar uso ou ocorrência",
        href: "/admin/utilitarios/papel-seguranca/lancar",
      },
      {
        label: "Gerar ofício ou relatório",
        href: "/admin/utilitarios/papel-seguranca/gerar",
      },
      {
        label: "Configuração",
        href: "/admin/utilitarios/papel-seguranca/configuracao",
      },
    ],
  },
  {
    // Orders of security paper (and ribbons, labels) to the suppliers, in
    // each supplier's own form (decision of 11/11/2026).
    group: "Utilitários",
    label: "Solicitação de papéis de segurança",
    href: "/admin/utilitarios/solicitacao-papeis",
    icon: "inbox",
    permission: "paper-orders.manage",
    children: [
      { label: "Pedidos", href: "/admin/utilitarios/solicitacao-papeis" },
      {
        label: "Novo pedido",
        href: "/admin/utilitarios/solicitacao-papeis/novo",
      },
      {
        label: "Dados do cartório",
        href: "/admin/utilitarios/solicitacao-papeis/configuracao",
      },
    ],
  },
  {
    // PAdES signatures with the office's A1 certificates (ICP-Brasil), each
    // with its verification code and QR (see lib/signing.ts).
    group: "Utilitários",
    label: "Assinador digital",
    href: "/admin/utilitarios/assinador",
    icon: "lock",
    permission: "signer.use",
    children: [
      { label: "Assinar documento", href: "/admin/utilitarios/assinador" },
      {
        label: "Certificados A1",
        href: "/admin/configuracoes/certificados",
        permission: "certificates.manage",
      },
    ],
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
    permission: "transparency.manage",
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
    group: "Ajuda e treinamentos",
    label: "Ajuda e treinamentos",
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

/**
 * Groups drawn as one topic instead of a heading (decision of 13/11/2026):
 * "Utilitários" folds as a single item, and its tools hang from it as
 * subtopics, each with its own screens one level further down. The data
 * stays flat, item by item, because the help screens read it to name the
 * panel's routes (ajuda/): only the sidebar draws the fold.
 */
export const FOLDED_GROUPS: Readonly<Record<string, AdminIconName>> = {
  // Decision of 14/11/2026: "atribuições fique igual utilitários,
  // minimizado".
  Atribuições: "library",
  Utilitários: "wrench",
};

/** Anything the sidebar draws as a line: an item, a tool, a screen. */
export interface AdminNavNode {
  label: string;
  href: string;
  children?: readonly AdminNavNode[];
}

function hrefsIn(nodes: readonly AdminNavNode[]): string[] {
  return nodes.flatMap((node) => [node.href, ...hrefsIn(node.children ?? [])]);
}

/**
 * Which line of the tree is the current page: the exact path, or else the
 * longest one the path sits under, so a record opened from a list (a guia,
 * a lote) still lights the list it came from. Undefined when the page is
 * outside the tree, which also says whether a fold holds the current page.
 */
export function currentHref(
  nodes: readonly AdminNavNode[],
  pathname: string,
): string | undefined {
  const hrefs = hrefsIn(nodes);
  if (hrefs.includes(pathname)) return pathname;
  return hrefs
    .filter((href) => pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * What a closed fold carries in its badge: the counts of everything inside.
 * A tool's count is keyed by its own href, which is also its first screen's,
 * so it is summed once, at the leaf.
 */
export function countIn(
  node: AdminNavNode,
  counts: Readonly<Record<string, number>>,
): number {
  if (!node.children?.length) return counts[node.href] ?? 0;
  return node.children.reduce((sum, child) => sum + countIn(child, counts), 0);
}
