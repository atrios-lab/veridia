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
import { Badge } from "../../_ui/badge.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../_ui/table.tsx";
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
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  )
    notFound();

  const tenant = await getTenant();
  const accounts = await listAccounts(tenant.slug);

  return (
    <>
      <AdminPageHeader maxWidth={1100} title="Usuários" />
      <main className="grid max-w-[1100px] grid-cols-1 gap-6 px-4 pt-6 pb-8 md:px-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-3.5 text-base font-semibold text-foreground">
            Contas do painel
          </div>
          <Table>
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className="hover:bg-transparent">
                  <TableCell className="w-full max-w-0 min-w-40 py-3.5 pl-5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {account.name}
                      {account.id === session.user.id && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          {" "}
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account.email}
                    </p>
                    {/* A change nobody can see is a change nobody remembers
                        asking for: the registrador saves, the list looks the
                        same, and the pending confirmation is invisible. */}
                    {account.pendingEmail && (
                      <p className="truncate text-xs text-warning-text">
                        Troca para {account.pendingEmail} aguardando confirmação
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline">
                      {ROLE_LABELS[account.role as Role] ?? account.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    {account.disabled ? (
                      <Badge className="bg-destructive text-destructive-foreground">
                        Acesso desativado
                      </Badge>
                    ) : account.active ? (
                      <Badge className="bg-success text-success-foreground">
                        Ativa
                      </Badge>
                    ) : (
                      <Badge className="bg-warning text-warning-foreground">
                        Aguardando 1º acesso
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 pr-5">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <CreateAccountForm />
      </main>
    </>
  );
}
