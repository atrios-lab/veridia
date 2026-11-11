/**
 * How much an act of the trail asks of the Tabelião/Registrador (decision
 * of 11/11/2026), in three bands and the routine below them:
 *
 * - urgente: what can hide an error, fraud, dolo, culpa or bad intent
 *   (decision of 11/11/2026): every exclusion of an act or a document,
 *   money (the Pix key), access and identity (accounts, e-mail, two-step
 *   access, a sign-in refused at another office). The only band that
 *   alerts the holder, on the panel, until he marks it as seen. The
 *   others are kept for searching, without alert.
 * - atencao: what changes a value, a deadline, a number, a permission or a
 *   signature's rules. Worth a look the same day.
 * - analise: what changes what the public reads (publications, the site,
 *   the identity) or the office's settings. Reviewed in batches.
 * - rotina: signing in, reading, sending. Never flagged.
 *
 * Exact codes first, then by verb, so an act added later lands in a band
 * without anyone remembering this file.
 */
export const AUDIT_LEVELS = [
  "urgente",
  "atencao",
  "analise",
  "rotina",
] as const;
export type AuditLevel = (typeof AUDIT_LEVELS)[number];

export const AUDIT_LEVEL_LABELS: Record<AuditLevel, string> = {
  urgente: "Urgente",
  atencao: "Atenção",
  analise: "Análise",
  rotina: "Rotina",
};

/** In the holder's words: why each band is what it is. */
export const AUDIT_LEVEL_HINTS: Record<AuditLevel, string> = {
  urgente:
    "Atos que podem esconder erro, fraude, dolo, culpa ou má intenção: exclusões, chave Pix, contas, e-mails e acesso ao painel. Só estes alertam, até você verificar.",
  atencao:
    "Valores, prazos, números, permissões e certificados. Sem alerta: ficam para pesquisa e conferência.",
  analise:
    "Publicações, site, identidade e configurações. Sem alerta: ficam para pesquisa.",
  rotina: "Entradas no painel e atos do dia a dia.",
};

const EXACT: Record<string, AuditLevel> = {
  "session.denied-tenant": "urgente",
  "office-pix.save": "urgente",
  "office-pix.remove": "urgente",
  "user.create": "urgente",
  "user.invite": "urgente",
  "user.reactivate": "urgente",
  // Taking access away protects the office: worth knowing, not alarming.
  "user.deactivate": "atencao",
  "user.email-changed": "urgente",
  "user.password-reset-link-issued": "urgente",
  "platform.two-step-off": "urgente",
  "signing-certificate.add": "urgente",
  "signing-certificate.signers": "urgente",
  "signed-document.remove": "urgente",
  "appointment.remove": "urgente",
  "compliance-intake.detach": "urgente",

  "service-request.amount": "atencao",
  "service-request.deadline": "atencao",
  "service-request.exemption-decision": "atencao",
  "service-request.key-reissue": "atencao",
  "service-request.edit": "atencao",
  "appointment.key-reissue": "atencao",
  "appointment.correct": "atencao",
  "appointment.revert": "atencao",
  "tax-guide.update": "atencao",
  "tax-guide.renumber": "atencao",
  "office-settings.role-permissions": "atencao",
  "signing-certificate.disable": "atencao",
  "signed-document.restore": "atencao",
  "user.update": "atencao",
  "user.email-change-requested": "atencao",
  "fee-table.items": "atencao",
  "platform.two-step-on": "atencao",
  "audit.notification": "atencao",
  "messenger.lunch-request": "atencao",
  "messenger.chat-off": "atencao",
  "messenger.chat-on": "analise",
  "messenger.lunch-approve": "analise",
  "messenger.lunch-reject": "analise",
  // A chat message hidden by its own author: kept for the holder, no alarm.
  "messenger.message-delete": "analise",
  "messenger.message-edit": "rotina",
  "messenger.conversation-clear": "rotina",
  "audit.notification-answer": "atencao",

  "office-settings.save": "analise",
  "office-brand.save": "analise",
  "office-dpo.save": "analise",
  "agenda.settings": "analise",
  "chat.settings": "analise",
  "publication.create": "analise",
  "publication.update": "analise",
  "publication.archive": "analise",
  "transparency.document.create": "analise",
  "transparency.document.publish": "analise",
  "transparency.document.unpublish": "analise",
  "transparency.bulletin.publish": "analise",
  "service-request.delivery-rename": "analise",
  "service-request.requirement.edit": "analise",
  "appointment.close-day": "analise",
  // Training material, not an act of the office: no one is harmed.
  "course.delete": "analise",
  "course-question.delete": "analise",
  "tutorial.delete": "analise",
};

export function auditLevel(action: string): AuditLevel {
  const exact = EXACT[action];
  if (exact) return exact;
  // Anything that removes, wherever it is: urgent.
  if (new RegExp(URGENT_VERBS_PATTERN).test(action)) {
    return "urgente";
  }
  return "rotina";
}

/** The codes named for this band (the verbs rule catches the rest). */
export function exactActions(level: AuditLevel): string[] {
  return Object.entries(EXACT)
    .filter(([, value]) => value === level)
    .map(([action]) => action);
}

/** The verbs that make any act urgent, as a Postgres regular expression. */
export const URGENT_VERBS_PATTERN = "(^|[.-])(delete|remove|detach)($|[.-])";

/** The levels that alert the holder until he marks them as seen. */
export function needsReview(level: AuditLevel): boolean {
  return level === "urgente";
}

/**
 * The minimum a justification needs to say something: an exclusion with
 * "ok" for a reason is no reason.
 */
export const MIN_JUSTIFICATION = 10;

export function validJustification(text: string): boolean {
  return text.trim().length >= MIN_JUSTIFICATION;
}
