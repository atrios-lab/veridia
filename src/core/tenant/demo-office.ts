// The demonstration office the course participants work in (change
// painel-livre-para-alunos): a fictional office, `demo` on in its config,
// whose desk every participant shares. Nothing done there may leave the
// platform. The rules for that live here, without I/O, and every sending
// path asks them.

/** The part of an office these rules read. */
export interface DemoAware {
  demo?: boolean;
}

/**
 * Who an e-mail is for, as far as the demonstration office cares:
 * - "account": the person's own way in (password, access code, change of
 *   address, invitation). Without it the participant cannot sign in, and it
 *   goes to the account's own address.
 * - "office": everything the office says to someone else (the citizen, the
 *   applicant, the team, the Átrios). In the demonstration office the
 *   address on it was typed by a participant and may belong to anyone.
 */
export type EmailKind = "account" | "office";

/** Whether the message stays in the demonstration outbox instead of going
 * out. */
export function holdsEmail(tenant: DemoAware, kind: EmailKind): boolean {
  return tenant.demo === true && kind === "office";
}

/**
 * Whether the office may call a system outside the platform on its own
 * account: a prefeitura, the CENSEC, the Receita Federal, the Justiça
 * Aberta, a search engine. Never from the demonstration office, whose
 * records are made up or typed by participants. Producing a file to
 * download stays allowed: it does not leave anything anywhere.
 */
export function isOutboundAllowed(tenant: DemoAware): boolean {
  return tenant.demo !== true;
}

/** Whether the panel shows the demonstration bar: to a course participant
 * in the demonstration office, never to the Átrios account working there. */
export function showsDemoPanelNotice(role: string, tenant: DemoAware): boolean {
  return role === "learner" && tenant.demo === true;
}

/** The bar on top of every panel screen a participant opens in the
 * demonstration office (approved by the user on 16/11/2026). */
export const DEMO_PANEL_NOTICE = {
  title: "Painel de demonstração do {officeName}, que não existe.",
  body: "O que você fizer aqui fica visível para os outros participantes e pode ser apagado a qualquer momento. Não use dados reais.",
} as const;

/** What the history of a record says where an e-mail would have gone. */
export const DEMO_EMAIL_HELD_LABEL = "Demonstração: e-mail não enviado";
