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
  // The internal messenger, split off the desk (change
  // painel-livre-para-alunos): a course participant has the desk of the
  // demonstration office but not the conversations between the people in
  // it, who are other participants.
  "messages.use",
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
  // The changes of ownership of imóveis told to the prefeitura (CNN,
  // art. 184-A): read the title, the month's ofício, the sending.
  "titularidade.manage",
  // The CENSEC's quinzenal loads (CNN, arts. 265 to 272): read the
  // escrituras, procurações and testamentos, the files, the fechamento.
  "censec.manage",
  // The DOI to the Receita Federal (IN RFB nº 2.186/2024), its own item
  // (decision of 15/11/2026: "a DOI tem que ficar no item à parte").
  "doi.manage",
  // The legal base the AI is taught with (decision of 15/11/2026): laws,
  // provimentos, jurisprudence and models, kept as Markdown.
  "knowledge.manage",
  // The qualificação de títulos (change qualificacao-de-titulos): the
  // notas devolutivas, the reexames, the qualificações positivas and the
  // library of exigências.
  "qualificacao.manage",
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
  // Correcting a registro of the index, cancelling it and restoring it
  // (decision of 14/11/2026), always with a justification.
  "rcpn.edit",
  // The habilitação para o casamento (change habilitacao-de-casamento):
  // open the processo, correct it, publish the edital, cancel, restore.
  "rcpn.habilitacao",
  // The guides of the attributions (decision of 14/11/2026): books,
  // indexes and deadlines of each specialty, as the law sets them.
  "attributions.view",
  // Sending each attribution its files (decision of 14/11/2026).
  "attributions.import",
  // The office's audit trail in full, and the formal notifications that ask
  // a person to explain an act: the Tabelião/Registrador's alone.
  "audit.manage",
  // The DPO assistant (change assistente-do-dpo): questions on data
  // protection to the AI, and the draft reply of an LGPD requerimento.
  // Everyone at the desk has it from day one (decision of 15/11/2026:
  // "todos que usam a plataforma"); the Tabelião/Registrador may take it.
  "dpo.assist",
  // The final decision on the answer to an LGPD requerimento (decision of
  // 15/11/2026: "a decisão final é do DPO e tabelião"): approve the text
  // the team aligned with the Assistente Virtual, or send it directly.
  // Derived from nothing: the Tabelião/Registrador grants it to the
  // encarregado.
  "lgpd.decide",
  // The Tabelião validates what the Assistente Virtual proposed before it
  // goes to the client (decision of 15/11/2026: "o tabelião valida para
  // postar ou enviar"). Derived from nothing: the Tabelião grants it.
  "qualificacao.validate",
] as const;

/**
 * What only the Tabelião/Registrador holds and never hands to anyone:
 * registering people and setting what they do, and the audit.
 */
export const RESERVED_PERMISSIONS = ["user.manage", "audit.manage"] as const;

/** What the Tabelião/Registrador may grant to the other positions. */
export const GRANTABLE_PERMISSIONS = [
  "desk.access",
  "messages.use",
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
  "titularidade.manage",
  "censec.manage",
  "doi.manage",
  "knowledge.manage",
  "qualificacao.manage",
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
  "rcpn.edit",
  "rcpn.habilitacao",
  "attributions.view",
  "attributions.import",
  "dpo.assist",
  "lgpd.decide",
  "qualificacao.validate",
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
  "titularidade.manage": "guides.manage",
  // Whoever tells the prefeitura the month's escrituras loads the CENSEC.
  "censec.manage": "titularidade.manage",
  // Whoever told the prefeitura the month's acts declares them to the RFB.
  "doi.manage": "titularidade.manage",
  "signer.use": "desk.access",
  // Everyone at the desk kept the messenger the day it got its own line.
  "messages.use": "desk.access",
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
  // Whoever loads the base corrects it.
  "rcpn.edit": "rcpn.import",
  "rcpn.habilitacao": "rcpn.certidao",
  // Everyone at the desk reads the guides.
  "attributions.view": "desk.access",
  // Whoever loads the Registro Civil's base loads the others' files.
  "attributions.import": "rcpn.import",
  // Whoever loads the attributions' files loads the legal base.
  "knowledge.manage": "attributions.import",
  // Whoever answers the pedidos at the counter qualifies the títulos.
  "qualificacao.manage": "requests.manage",
  "dpo.assist": "desk.access",
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
  // The DPO assistant's oversight: every office's usage, conversations and
  // monthly ceiling (lib/dpo/store.ts). The Átrios master account only.
  "dpo.oversee",
  // The Assistente Virtual of each office (decision of 16/11/2026): held
  // back or allowed above the Tabelião's switch, and how the notes attached
  // to exigências are reviewed (IA, base alone, off). The Átrios master
  // account only; the office never sees it.
  "ai.oversee",
] as const;

export const PERMISSIONS = [
  ...OFFICE_PERMISSIONS,
  ...PLATFORM_PERMISSIONS,
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * What a course participant may NOT do in the demonstration office (change
 * painel-livre-para-alunos), where everything else of the office is theirs
 * to use with made-up data. Each line closes something that would show the
 * other participants (their list, their conversations, the audit of what
 * they did), lock the office for all of them (two steps, hours), point the
 * citizen's money somewhere (Pix), take a real credential or a real office's
 * base (signer, certificates, imports), or spend AI credit.
 */
export const DEMO_CLOSED_PERMISSIONS = [
  "user.manage",
  "audit.manage",
  "access.manage",
  "messages.use",
  "billing.edit",
  "chat.manage",
  "chat.settings",
  "signer.use",
  "certificates.manage",
  "rcpn.import",
  "attributions.import",
  "knowledge.manage",
  "dpo.assist",
  "qualificacao.validate",
] as const satisfies readonly OfficePermission[];

/**
 * What a course participant may do in the demonstration office: the rest,
 * each one reviewed. Never derived from the list above by subtraction: a
 * permission added to the office later is in neither list until someone
 * decides, and roles.test.ts fails until they do.
 */
export const DEMO_OPEN_PERMISSIONS = [
  "desk.access",
  "content.edit",
  "content.publish",
  "branding.edit",
  "requests.manage",
  "channels.manage",
  "guides.manage",
  "iss.manage",
  "titularidade.manage",
  "censec.manage",
  "doi.manage",
  "qualificacao.manage",
  "transparency.manage",
  "numbering.manage",
  "security-paper.manage",
  "paper-orders.manage",
  "daily-book.manage",
  "rcpn.search",
  "rcpn.certidao",
  "rcpn.edit",
  "rcpn.habilitacao",
  "attributions.view",
  "lgpd.decide",
] as const satisfies readonly OfficePermission[];

type OfficePermission = (typeof OFFICE_PERMISSIONS)[number];

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
  tenant?: { demo?: boolean },
): readonly Permission[] {
  if (!isRole(role)) return [];
  if (role === "learner") {
    return tenant?.demo
      ? ["admin.access", ...DEMO_OPEN_PERMISSIONS]
      : ROLE_PERMISSIONS.learner;
  }
  if (role === "admin" || role === "superadmin") {
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
export function homeFor(
  role: string,
  tenant?: { demo?: boolean },
): string | null {
  // In the demonstration office the participant has the desk, and the
  // overview is where it starts (change painel-livre-para-alunos).
  return role === "learner" && !tenant?.demo ? "/admin/ajuda" : null;
}

/** What each grantable permission opens, in the office's words. */
export const GRANTABLE_LABELS: Record<GrantablePermission, string> = {
  "desk.access": "Visão geral e mesa de trabalho",
  "messages.use": "Mensagens internas",
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
  "titularidade.manage":
    "Comunicação de mudança de titularidade de imóveis à prefeitura (CNN, art. 184-A)",
  "censec.manage":
    "Cargas da CENSEC: CEP, CESDI e RCTO por quinzena (CNN, arts. 265 a 272)",
  "doi.manage": "Carga da DOI à Receita Federal (IN RFB nº 2.186/2024)",
  "knowledge.manage":
    "Base jurídica do Assistente Virtual: enviar, corrigir e excluir leis, provimentos, jurisprudência e modelos",
  "qualificacao.manage":
    "Qualificação de títulos: notas devolutivas, reexames, qualificações positivas e biblioteca de exigências",
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
  "rcpn.edit":
    "Registro Civil: alterar, cancelar e estornar registros do índice (com justificativa)",
  "rcpn.habilitacao":
    "Registro Civil: habilitação de casamento (abrir, alterar, publicar o edital, cancelar e estornar)",
  "attributions.view":
    "Atribuições: consultar os guias de cada especialidade (livros, índices e prazos da lei)",
  "attributions.import":
    "Atribuições: enviar e excluir arquivos de cada atribuição (com justificativa)",
  "dpo.assist":
    "Assistente do DPO: dúvidas de proteção de dados e rascunho de resposta à LGPD",
  "lgpd.decide":
    "Requerimento LGPD: decisão final sobre a resposta ao titular (aprovar e enviar)",
  "qualificacao.validate":
    "Qualificação: validar a nota com exigência do Assistente Virtual antes de ir ao cliente",
};
