import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  user as userTable,
  verification as verificationTable,
} from "@/db/auth-schema.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { PasswordField } from "../_components/password-field.tsx";
import { acceptInvite } from "./actions.ts";

export const metadata = { title: "Criar senha" };

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
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, row.userId));
  return invitedUser ?? null;
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; erro?: string }>;
}) {
  if (await getSession()) redirect("/admin");
  const { token, erro } = await searchParams;
  const invite = token ? await findInvite(token) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-admin-surface px-6 py-12">
      <div className="w-full max-w-[400px]">
        {invite ? (
          <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
            <div>
              <h1 className="font-serif text-xl font-semibold text-admin-primary">
                Bem-vindo(a), {invite.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-admin-muted">
                Crie sua senha para começar a usar o painel: só você vai
                conhecê-la.
              </p>
            </div>
            {erro === "1" && (
              <p
                role="alert"
                className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
              >
                As senhas não coincidem.
              </p>
            )}
            <form action={acceptInvite} className="flex flex-col gap-3.5">
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
              <button
                type="submit"
                className="mt-1 rounded-lg bg-admin-primary-soft px-5 py-3 text-sm font-bold text-white"
              >
                Criar senha e entrar
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-warning-bg">
              <AdminIcon
                name="clock"
                className="h-5 w-5 text-admin-warning-text"
              />
            </span>
            <div>
              <h1 className="font-serif text-xl font-semibold text-admin-primary">
                Este convite venceu
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-admin-muted">
                Por segurança, o link de primeiro acesso vale 48 horas. Peça um
                novo a quem responde pela serventia: o registrador reenvia pela
                tela de Usuários, e chega no mesmo e-mail.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-admin-faint">
              Sem botão de "reenviar para mim": quem não tem senha ainda não tem
              como se autenticar para pedir.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
