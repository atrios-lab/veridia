/**
 * Shared shape for the platform's card-style outgoing e-mails: a subject, a
 * few paragraphs, one button, one footnote. `src/lib/email/render.ts` turns
 * one of these into HTML and plain text; every concern that sends this kind
 * of e-mail (account access, a question answered) builds one, never markup.
 */
export interface EmailText {
  subject: string;
  paragraphs: readonly string[];
  buttonLabel: string;
  footnote: string;
}
