import { isRegisteredSlug } from "../tenant/resolve.ts";

// The auth library answers "who is this". What each role may do, and which
// office they may do it in, is decided here, as pure functions, so replacing
// the library never means rewriting authorization.

export const ROLES = [
  "admin",
  "substituto-legal",
  "substituto",
  "staff",
  "auxiliar",
  "contador",
  "rh",
  "superadmin",
  "learner",
] as const;
export type Role = (typeof ROLES)[number];

// The subset a registrador may assign from the panel. Superadmin is an
// Átrios platform role, created only by scripts/seed-superadmin.ts: never
// offered in the account form or accepted from a forged submission.
// The office's own positions (decision of 11/11/2026): "admin" is the
// Tabelião/Registrador, "staff" the Escrevente (the ids stay, so every
// existing account keeps its place), and the other five are new.
export const PANEL_ROLES = [
  "admin",
  "substituto-legal",
  "substituto",
  "staff",
  "auxiliar",
  "contador",
  "rh",
] as const;
export type PanelRole = (typeof PANEL_ROLES)[number];

// The office column is NOT NULL, so a platform account still needs a value.
// This slug is deliberately never registered in src/core/tenant, so it never
// equals a real tenant slug and never appears on any office's user list.
export const SUPERADMIN_TENANT_SLUG = "atrios";

// What a role may do inside its own office. Every permission a registrador
// can hold is here, and only here.
export const OFFICE_PERMISSIONS = [
  "admin.access",
  // The office's own desk: the overview and the shortcut to the office's
  // mailbox. Every role that works for an office has it; a course learner,
  // who only came for the training, does not.
  "desk.access",
  "content.edit",
  "content.publish",
  "branding.edit",
  "billing.edit",
  "user.manage",
  "requests.manage",
  "chat.manage",
  "chat.settings",
  "channels.manage",
  // One per tool (decision of 11/11/2026): each new feature gets its own
  // line in Perfis e permissões, so the Tabelião/Registrador decides who
  // sees it. A new one starts as the one it was split from (DERIVED_FROM).
  "guides.manage",
  "iss.manage",
  "signer.use",
  "transparency.manage",
  "numbering.manage",
  "access.manage",
  "certificates.manage",
  // Papel de segurança (decision of 11/11/2026): the lots, their use and
  // losses, and the ofícios to the Corregedoria (Prov. CGJ/RN 156/2016,
  // arts. 59 and 60).
  "security-paper.manage",
  // Solicitação de papéis de segurança (decision of 11/11/2026): the
  // suppliers, their forms and the orders.
  "paper-orders.manage",
  // Livro Diário Auxiliar da Receita e da Despesa (decision of 11/11/2026).
  "daily-book.manage",
  // The RCPN index (change consulta-de-registro-rcpn): searching it, and
  // sending the registry system's files that feed it. Two lines: who
  // answers the counter is not always who loads the office's whole base.
  "rcpn.search",
  "rcpn.import",
  // The certidões of the Registro Civil issued from the index (decision of
  // 14/11/2026): issue, correct, attach the signed one, exclude.
  "rcpn.certidao",
  // The guides of the attributions (decision of 14/11/2026): books,
  // indexes and deadlines of each specialty, as the law sets them.
  "attributions.view",
  // The office's audit trail in full, and the formal notifications that ask
  // a person to explain an act: the Tabelião/Registrador's alone.
  "audit.manage",
] as const;

/**
 * What only the Tabelião/Registrador holds and never hands to anyone:
 * registering people and setting what they do, and the audit.
 */
export const RESERVED_PERMISSIONS = ["user.manage", "audit.manage"] as const;

/** What the Tabelião/Registrador may grant to the other positions. */
export const GRANTABLE_PERMISSIONS = [
  "desk.access",
  "content.edit",
  "content.publish",
  "branding.edit",
  "billing.edit",
  "requests.manage",
  "chat.manage",
  "chat.settings",
  "channels.manage",
  "guides.manage",
  "iss.manage",
  "signer.use",
  "transparency.manage",
  "numbering.manage",
  "access.manage",
  "certificates.manage",
  "security-paper.manage",
  "paper-orders.manage",
  "daily-book.manage",
  "rcpn.search",
  "rcpn.import",
  "rcpn.certidao",
  "attributions.view",
] as const;
export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];

/**
 * A permission split off an older, broader one, and that older one. Until
 * the Tabelião/Registrador decides otherwise, whoever had the older one has
 * the new one too: a new line in Perfis e permissões never takes away what
 * someone could already do the day before (decision of 11/11/2026).
 */
export const DERIVED_FROM: Partial<Record<GrantablePermission, Permission>> = {
  "guides.manage": "requests.manage",
  "iss.manage": "requests.manage",
  "signer.use": "desk.access",
  "transparency.manage": "content.edit",
  "numbering.manage": "content.edit",
  "access.manage": "user.manage",
  "certificates.manage": "user.manage",
  // Whoever issues the certidões and traslados uses the paper.
  "security-paper.manage": "requests.manage",
  // Listed after its parent: `withDerived` adds it in the same pass.
  "paper-orders.manage": "security-paper.manage",
  // Whoever declares the ISS works the book the ISS comes from.
  "daily-book.manage": "iss.manage",
  // Whoever answers the búsca at the counter searches the index. Loading
  // the base derives from nothing: the Tabelião/Registrador grants it.
  "rcpn.search": "requests.manage",
  // Whoever issued certidões on the paper issues them here.
  "rcpn.certidao": "security-paper.manage",
  // Everyone at the desk reads the guides.
  "attributions.view": "desk.access",
};

/**
 * The list plus every permission derived from one in it. `known`: the
 * permissions that existed when the list was saved; one created later
 * follows its parent, one the office already decided on is left alone.
 */
export function withDerived(
  list: readonly string[],
  known?: readonly string[],
): string[] {
  const result = new Set(list);
  for (const [child, parent] of Object.entries(DERIVED_FROM)) {
    if (known?.includes(child)) continue;
    if (parent && result.has(parent)) result.add(child);
  }
  return [...result];
}

// What acts on the platform itself, the same for every office: content the
// Átrios account publishes and every serventia reads. Kept in its own list
// so that adding one can never widen a registrador's powers by accident:
// `admin` is granted OFFICE_PERMISSIONS, never PERMISSIONS, and the test
// walks this list to prove it.
export const PLATFORM_PERMISSIONS = [
  "tutorials.manage",
  // The course cohorts: offices that are not clients, their links and the
  // learners who joined through them.
  "cohorts.manage",
  // Liberação de acesso: turning the panel's two-step access off or on for
  // any office (lib/access-policy.ts). The Átrios master account only.
  "access.release",
] as const;

export const PERMISSIONS = [
  ...OFFICE_PERMISSIONS,
  ...PLATFORM_PERMISSIONS,
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // The office owner: everything the office has, nothing the platform has.
  admin: OFFICE_PERMISSIONS,
  // The Átrios platform account: every permission, everywhere it can log in.
  superadmin: PERMISSIONS,
  // Staff drafts and edits, but publishing, billing and user management stay
  // with the office owner: those are the actions nobody can undo quietly, and
  // the Pix key is where the citizen's money lands. Working the request
  // queue and the citizen channels (agenda, ouvidoria, LGPD, chat) is the
  // opposite: it is staff's actual day job, so it is granted here too.
  // Turning the office's chat on or off for the whole public site is not
  // (chat.settings), same split as billing.
  // A clerk of an office that is not a client yet, who joined through a
  // course cohort's link (see src/lib/cohorts.ts). The panel lets them in
  // and nothing more: every screen but the training answers 404 for want
  // of its own permission, which is what keeps the role this small. Never
  // in PANEL_ROLES: only the cohort sign-up creates one.
  learner: ["admin.access"],
  // The defaults of each position; the Tabelião/Registrador changes them in
  // Configurações › Perfis e permissões (effectivePermissions below).
  // The Substituto Legal answers for the office in the holder's absence:
  // everything but registering people and the audit.
  "substituto-legal": [
    "admin.access",
    ...OFFICE_PERMISSIONS.filter(
      (permission) =>
        permission !== "admin.access" &&
        !(RESERVED_PERMISSIONS as readonly string[]).includes(permission),
    ),
  ],
  substituto: defaultsOf([
    "admin.access",
    "desk.access",
    "content.edit",
    "content.publish",
    "requests.manage",
    "channels.manage",
    "chat.manage",
  ]),
  // The Escrevente (formerly "Operador").
  staff: defaultsOf([
    "admin.access",
    "desk.access",
    "content.edit",
    "requests.manage",
    "channels.manage",
    "chat.manage",
  ]),
  auxiliar: defaultsOf([
    "admin.access",
    "desk.access",
    "requests.manage",
    "chat.manage",
  ]),
  contador: defaultsOf(["admin.access", "desk.access", "content.edit"]),
  rh: defaultsOf(["admin.access", "desk.access"]),
};

/** A position's defaults, with the permissions split off them. */
function defaultsOf(list: readonly Permission[]): readonly Permission[] {
  return withDerived(list) as Permission[];
}

/** The permissions a position starts with, before the office changes them. */
export function defaultPermissions(role: string): readonly Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/**
 * What this person may do in their office: the position's defaults, or what
 * the Tabelião/Registrador set for it (only grantable permissions, always
 * with panel access). The holder and the Átrios account are never changed.
 */
export function effectivePermissions(
  role: string,
  configured?: Partial<Record<string, readonly string[]>>,
): readonly Permission[] {
  if (!isRole(role)) return [];
  if (role === "admin" || role === "superadmin" || role === "learner") {
    return ROLE_PERMISSIONS[role];
  }
  const chosen = configured?.[role];
  if (!chosen) return ROLE_PERMISSIONS[role];
  return [
    "admin.access",
    ...GRANTABLE_PERMISSIONS.filter((permission) =>
      chosen.includes(permission),
    ),
  ];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Whether deactivating this account would leave the office with zero active
 * Registrador accounts: the one role that holds `user.manage`, so losing
 * the last of them locks the office out of ever undoing it. Any other
 * leaving never trips this: only "admin" counts.
 */
export function isLastActiveAdmin(
  role: string,
  otherActiveAdminCount: number,
): boolean {
  return role === "admin" && otherActiveAdminCount <= 0;
}

/** A session whose account had its access turned off carries this. */
export function isAccountDisabled(
  disabledAt: Date | null | undefined,
): boolean {
  return disabledAt != null;
}

/**
 * Whether this role may do this. `granted` is the person's effective list
 * (lib/session.ts puts it on the session): when given, it decides; without
 * it, the position's defaults do (client screens, tests).
 */
export function can(
  role: string,
  permission: Permission,
  granted?: readonly string[],
): boolean {
  if (!isRole(role)) return false;
  if (granted) return granted.includes(permission);
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Whether a panel user may act on an office. A user belongs to exactly one,
 * and no role widens that except superadmin, the Átrios platform account:
 * the role says what the person does, this says where. Callers combine the
 * two, so each one can report which failed.
 *
 * An orphan slug, one whose office left the registry, authorizes nothing.
 * The failure mode has to be no access, never access to the wrong office.
 */
export function canAccessTenant(
  role: string,
  userTenantSlug: string,
  tenantSlug: string,
): boolean {
  if (role === "superadmin") return isRegisteredSlug(tenantSlug);
  if (!userTenantSlug || !isRegisteredSlug(userTenantSlug)) return false;
  return userTenantSlug === tenantSlug;
}

/**
 * Where the panel's home sends a role that has no desk of its own. A
 * learner's panel is the training and nothing else, so the overview, all
 * empty cards for them, is skipped. Null: the overview is the home.
 */
export function homeFor(role: string): string | null {
  return role === "learner" ? "/admin/ajuda" : null;
}

/** What each grantable permission opens, in the office's words. */
export const GRANTABLE_LABELS: Record<GrantablePermission, string> = {
  "desk.access": "Visão geral e mesa de trabalho",
  "content.edit": "Editar o site e as configurações da serventia",
  "content.publish": "Publicar no site (editais, notícias, documentos)",
  "branding.edit": "Identidade visual (cores e logotipos)",
  "billing.edit": "Cobrança e chave Pix",
  "requests.manage": "Pedidos de serviço",
  "chat.manage": "Atendimento online (chat)",
  "chat.settings": "Ligar ou desligar o chat do site",
  "channels.manage": "Agenda, LGPD e ouvidoria",
  "guides.manage": "Guias de transmissão de bens (ITIV, ITCD, laudêmio)",
  "iss.manage": "Declaração de ISS ao fisco municipal",
  "signer.use": "Assinador digital (assinar documentos)",
  "transparency.manage": "Transparência (boletim mensal e documentos)",
  "numbering.manage": "Numeração de documentos",
  "access.manage": "Duas etapas e horário de acesso (ligar, desligar, liberar)",
  "certificates.manage": "Certificados digitais da serventia",
  "security-paper.manage":
    "Papel de segurança (lotes, uso, extravios e ofícios à Corregedoria)",
  "paper-orders.manage":
    "Solicitação de papéis de segurança (empresas, modelos e pedidos)",
  "daily-book.manage":
    "Livro Diário Auxiliar da Receita e da Despesa (lançamentos, PDFs e balanço)",
  "rcpn.search": "Registro Civil: pesquisar o índice de registros",
  "rcpn.import":
    "Registro Civil: enviar os arquivos do sistema do registro civil ao índice",
  "rcpn.certidao":
    "Registro Civil: emitir, corrigir e excluir certidões (com selo e anexo)",
  "attributions.view":
    "Atribuições: consultar os guias de cada especialidade (livros, índices e prazos da lei)",
};
