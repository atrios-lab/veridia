import { and, eq, gt, like, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { can, type Role } from "@/core/auth/roles.ts";
import {
  account as accountTable,
  user as userTable,
  verification as verificationTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { parseEmailChangeValue } from "@/lib/auth-tokens.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../_components/role-labels.ts";
import { AccountRowActions } from "./account-row-actions.tsx";
import { CreateAccountForm } from "./create-account-form.tsx";

export const metadata = { title: "Usuários" };

/**
 * "Ativa" vs. "Aguardando 1º acesso" is derived, not stored: a row in
 * `account` for the `credential` provider only exists once the person has
 * set their own password (see design.md: no new column needed for this).
 * "Acesso desativado" outranks both: an account can already have its own
 * password and still have `disabledAt` set.
 */
async function listAccounts(tenantSlug: string) {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      credentialId: accountTable.id,
      disabledAt: userTable.disabledAt,
      pendingEmailValue: verificationTable.value,
    })
    .from(userTable)
    .leftJoin(
      accountTable,
      and(
        eq(accountTable.userId, userTable.id),
        eq(accountTable.providerId, "credential"),
      ),
    )
    // A live e-mail change, if there is one. `verification` has no foreign
    // key to `user`, so the join is on the id the value is prefixed with
    // (see issueEmailChangeTokenWith). Expired rows are left out: they are
    // no longer a change anyone can complete.
    .leftJoin(
      verificationTable,
      and(
        like(verificationTable.identifier, "change-email:%"),
        sql`${verificationTable.value} LIKE ${userTable.id} || '|%'`,
        gt(verificationTable.expiresAt, new Date()),
      ),
    )
    .where(eq(userTable.tenantSlug, tenantSlug))
    .orderBy(userTable.createdAt);

  return rows.map((row) => ({
    ...row,
    active: row.credentialId !== null,
    disabled: row.disabledAt !== null,
    pendingEmail: row.pendingEmailValue
      ? (parseEmailChangeValue(row.pendingEmailValue)?.email ?? null)
      : null,
  }));
}

export default async function UsuariosPage() {
  // Hiding "Usuários" from the sidebar is a courtesy, not the gate: see
  // admin-shell spec. This is the gate.
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "user.manage")) notFound();

  const tenant = await getTenant();
  const accounts = await listAccounts(tenant.slug);

  return (
    <>
      <AdminPageHeader title="Usuários" />
      <main className="grid max-w-[1100px] grid-cols-1 gap-4.5 px-[30px] py-7 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="rounded-2xl border border-admin-border bg-admin-card">
          <div className="border-b border-admin-border px-5 py-3.5 font-serif text-base font-semibold text-admin-primary">
            Contas do painel
          </div>
          <div className="flex flex-col divide-y divide-admin-border">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="grid grid-cols-[minmax(0,1fr)_110px_170px_minmax(150px,max-content)] items-center gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-admin-text">
                    {account.name}
                    {account.id === session.user.id && (
                      <span className="ml-1 font-normal text-admin-faint">
                        {" "}
                        (você)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11.5px] text-admin-faint">
                    {account.email}
                  </p>
                  {/* A change nobody can see is a change nobody remembers
                      asking for: the registrador saves, the list looks the
                      same, and the pending confirmation is invisible. */}
                  {account.pendingEmail && (
                    <p className="truncate text-[11.5px] text-admin-warning-text">
                      Troca para {account.pendingEmail} aguardando confirmação
                    </p>
                  )}
                </div>
                <span className="text-[12.5px] text-admin-muted">
                  {ROLE_LABELS[account.role as Role] ?? account.role}
                </span>
                <span>
                  {account.disabled ? (
                    <span className="rounded-full bg-admin-error-bg px-2.5 py-1 text-[11px] font-bold text-admin-error-text">
                      Acesso desativado
                    </span>
                  ) : account.active ? (
                    <span className="rounded-full bg-admin-success-bg px-2.5 py-1 text-[11px] font-bold text-admin-success-text">
                      Ativa
                    </span>
                  ) : (
                    <span className="rounded-full bg-admin-warning-bg px-2.5 py-1 text-[11px] font-bold text-admin-warning-text">
                      Aguardando 1º acesso
                    </span>
                  )}
                </span>
                <div className="flex justify-end">
                  <AccountRowActions
                    account={{
                      id: account.id,
                      name: account.name,
                      email: account.email,
                      role: account.role,
                    }}
                    active={account.active}
                    disabled={account.disabled}
                    isSelf={account.id === session.user.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <CreateAccountForm />
      </main>
    </>
  );
}
