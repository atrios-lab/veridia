"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canAccessTenant } from "@/core/auth/roles.ts";
import { recordAudit } from "@/lib/audit.ts";
import { auth } from "@/lib/auth.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export async function signIn(formData: FormData) {
  const requestHeaders = await headers();
  if (await isRateLimited(requestHeaders)) redirect("/admin/login?erro=limite");

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  let userId: string;
  let userTenantSlug: string;
  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
    userId = result.user.id;
    userTenantSlug = result.user.tenantSlug;
  } catch (error) {
    // One generic outcome for every failure. Telling the visitor which field
    // was wrong turns the login form into a list of valid e-mail addresses.
    if (error instanceof APIError) redirect("/admin/login?erro=1");
    throw error;
  }

  const tenant = await getTenant();

  // The credential is valid, the office is not theirs. Ending the session
  // here is what keeps a live cookie for the wrong office from existing at
  // all, instead of leaving every future route to remember to check.
  if (!canAccessTenant(userTenantSlug, tenant.slug)) {
    await auth.api.signOut({ headers: requestHeaders });
    await recordAudit({
      tenantSlug: tenant.slug,
      actorId: userId,
      action: "session.denied-tenant",
      targetType: "tenant",
      targetId: tenant.slug,
    });
    // Same answer as a wrong password. Saying "that account belongs to
    // another office" confirms the address exists and says where the person
    // works.
    redirect("/admin/login?erro=1");
  }

  await recordAudit({
    tenantSlug: tenant.slug,
    actorId: userId,
    action: "session.sign-in",
    targetType: "user",
    targetId: userId,
  });

  // Only internal paths: an open redirect here would hand the login flow to
  // whoever crafts the link.
  redirect(next.startsWith("/admin/") || next === "/admin" ? next : "/admin");
}

export async function signOut() {
  const session = await getSession();
  if (session) {
    const tenant = await getTenant();
    await recordAudit({
      tenantSlug: tenant.slug,
      actorId: session.user.id,
      action: "session.sign-out",
      targetType: "user",
      targetId: session.user.id,
    });
  }
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
