import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@/core/auth/roles.ts";
import { formatFullDate } from "@/core/scheduling/calendar.ts";
import {
  account as accountTable,
  user as userTable,
  verification as verificationTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { AdminLockedSidebar } from "../_components/locked-sidebar.tsx";
import { PasswordField } from "../_components/password-field.tsx";
import { ROLE_LABELS } from "../_components/role-labels.ts";
import { SubmitButton } from "../_components/submit-button.tsx";
import { acceptInvite } from "./actions.ts";

export const metadata = { title: "Criar senha" };

/**
 * Whether this token is a first-access invite or a "nova senha" is not
 * stored anywhere: it is read off whether the account already has a
 * `credential` row in `account` at the moment the link is opened. Once the
 * form below is submitted it always will, so this only ever needs to be
 * checked before that.
 */
async function findInvite(token: string) {
  const [row] = await db
    .select({
      userId: verificationTable.value,
      expiresAt: verificationTable.expiresAt,
    })
    .from(verificationTable)
    .where(eq(verificationTable.identifier, `reset-password:${token}`));
  if (!row || row.expiresAt < new Date()) return null;

  const [invitedUser] = await db
    .select({
      name: userTable.name,
      role: userTable.role,
      credentialId: accountTable.id,
    })
    .from(userTable)
    .leftJoin(
      accountTable,
      and(
        eq(accountTable.userId, userTable.id),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .where(eq(userTable.id, row.userId));
  if (!invitedUser) return null;

  return {
    name: invitedUser.name,
    role: invitedUser.role,
    kind:
      invitedUser.credentialId === null
        ? ("convite" as const)
        : ("nova-senha" as const),
  };
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string }>;
}) {
  if (await getSession()) redirect("/admin");
  const { token, erro } = await searchParams;
  const invite = token ? await findInvite(token) : null;

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-12 md:px-6">
        <div className="w-full max-w-100">
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
            <span className="flex size-10 items-center justify-center rounded-full bg-warning">
              <AdminIcon
                name="clock"
                className="h-5 w-5 text-warning-foreground"
              />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Este link venceu
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Por segurança, os links de acesso ao painel valem 48 horas. Peça
                um novo com o seu e-mail: ele chega no mesmo endereço.
              </p>
            </div>
            <Link
              href="/admin/esqueci-senha"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Pedir um novo link
            </Link>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Se a sua conta ainda não existe, ou foi desativada, o link não
              chega: nesse caso, fale com quem responde pela serventia.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const tenant = await getTenant();
  const isFirstAccess = invite.kind === "convite";

  // Bounded to the viewport only beside the sidebar: on a phone the band
  // sits on top and the page scrolls as a whole, so the keyboard opening over
  // the form never traps it in a box shorter than the screen.
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <AdminLockedSidebar
        tenant={tenant}
        explanation={
          isFirstAccess
            ? "Crie sua senha para liberar o painel."
            : "Crie sua nova senha para voltar ao painel."
        }
        person={{
          name: invite.name,
          roleLabel: ROLE_LABELS[invite.role as Role] ?? invite.role,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col md:overflow-y-auto">
        <div className="flex h-14 flex-none items-center gap-4 border-b bg-background px-4 md:px-8">
          <h1 className="flex-1 text-lg font-semibold text-foreground">
            {isFirstAccess ? "Criar sua senha" : "Criar nova senha"}
          </h1>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {formatFullDate(today())}
          </span>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 py-8 md:px-6 md:py-16">
          <div className="w-full max-w-100 rounded-xl border bg-card p-5 shadow-xs md:p-6">
            {isFirstAccess ? (
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Bem-vindo(a), {invite.name.split(" ")[0]}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Crie sua senha para começar a usar o painel: só você vai
                  conhecê-la.
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Criar nova senha
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Sua senha atual continua valendo até você confirmar a nova. Ao
                  confirmar, as sessões abertas antes da troca são encerradas.
                </p>
              </div>
            )}

            {erro === "1" && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
              >
                As senhas não coincidem.
              </p>
            )}

            <form action={acceptInvite} className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <PasswordField
                label="Nova senha"
                name="password"
                autoComplete="new-password"
              />
              <PasswordField
                label="Repita a nova senha"
                name="confirmPassword"
                autoComplete="new-password"
              />
              <SubmitButton
                label="Criar senha e entrar"
                pendingLabel="Criando senha…"
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
