import "server-only";
import { buildAccountEmailText } from "@/core/auth/invite.ts";
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
}

export async function sendInviteEmail(
  params: SendInviteEmailParams,
): Promise<void> {
  const text = buildAccountEmailText({
    kind: "convite",
    recipientName: params.recipientName,
    inviterName: params.inviterName,
    roleLabel: params.roleLabel,
  });
  await sendEmail({
    to: params.to,
    fromName: params.tenant.name,
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
    subject: text.subject,
    html: renderEmailCardHtml(
      text,
      tenantEmailIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderEmailCardText(text, params.actionUrl),
  });
}
