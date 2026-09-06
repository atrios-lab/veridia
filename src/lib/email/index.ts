import "server-only";
import {
  buildAccountEmailText,
  type InviteEmailKind,
} from "@/core/auth/invite.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import {
  renderEmailCardHtml,
  renderEmailCardText,
  tenantEmailIdentity,
} from "./render.ts";
import { sendEmail } from "./send.ts";

export interface SendInviteEmailParams {
  to: string;
  recipientName: string;
  inviterName: string;
  roleLabel: string;
  actionUrl: string;
  tenant: Tenant;
  /** Same link either way; see inviteEmailKind for who gets which words. */
  kind?: InviteEmailKind;
}

export async function sendInviteEmail(
  params: SendInviteEmailParams,
): Promise<void> {
  const text = buildAccountEmailText({
    kind: params.kind ?? "convite",
    recipientName: params.recipientName,
    inviterName: params.inviterName,
    roleLabel: params.roleLabel,
    tenantName: params.tenant.name,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
    fromAddress: params.tenant.emailFrom,
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}

export interface SendPasswordResetEmailParams {
  to: string;
  recipientName: string;
  actionUrl: string;
  tenant: Tenant;
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams,
): Promise<void> {
  const text = buildAccountEmailText({
    kind: "nova-senha",
    recipientName: params.recipientName,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
    fromAddress: params.tenant.emailFrom,
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}

export interface SendEmailChangeEmailParams {
  /** The address being moved to: this message never goes to the current one. */
  to: string;
  recipientName: string;
  /** The login that keeps working until this link is opened. */
  currentEmail: string;
  actionUrl: string;
  tenant: Tenant;
}

export async function sendEmailChangeEmail(
  params: SendEmailChangeEmailParams,
): Promise<void> {
  const text = buildAccountEmailText({
    kind: "troca-email",
    recipientName: params.recipientName,
    currentEmail: params.currentEmail,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
    fromAddress: params.tenant.emailFrom,
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}

export interface SendEmailChangedNoticeParams {
  /** The address left behind. It is the only warning that reaches the person
   * if the change was not theirs, so it is sent even though nothing depends
   * on it arriving. */
  to: string;
  recipientName: string;
  newEmail: string;
  /** The office's login screen: every card e-mail carries a button, and this
   * is where someone who did not expect this message will want to go. */
  actionUrl: string;
  tenant: Tenant;
}

export async function sendEmailChangedNotice(
  params: SendEmailChangedNoticeParams,
): Promise<void> {
  const text = buildAccountEmailText({
    kind: "email-alterado",
    recipientName: params.recipientName,
    newEmail: params.newEmail,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
    fromAddress: params.tenant.emailFrom,
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}
