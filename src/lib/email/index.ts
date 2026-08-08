import "server-only";
import { buildAccountEmailText } from "@/core/auth/invite.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { renderAccountEmailHtml, renderAccountEmailText } from "./render.ts";
import { sendEmail } from "./send.ts";

function tenantIdentity(tenant: Tenant) {
  const host = tenant.hosts[0];
  if (!host) {
    throw new Error(`Serventia "${tenant.slug}" não tem host registrado.`);
  }
  return {
    name: tenant.name,
    subtitle: tenant.subtitle,
    // The seal for a light background (dark ink), same one the invite e-mail
    // mockup uses on its white body — see tenant.logos.seal in schema.ts.
    sealUrl: `https://${host}${tenant.logos.seal.light}`,
  };
}

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
    html: renderAccountEmailHtml(
      text,
      tenantIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderAccountEmailText(text, params.actionUrl),
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
    html: renderAccountEmailHtml(
      text,
      tenantIdentity(params.tenant),
      params.actionUrl,
    ),
    text: renderAccountEmailText(text, params.actionUrl),
  });
}
