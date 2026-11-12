import Link from "next/link";
import { redirect } from "next/navigation";
import { getPendingSession, getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { PasswordField } from "../_components/password-field.tsx";
import { OfficeMark } from "../_components/sidebar.tsx";
import { SubmitButton } from "../_components/submit-button.tsx";
import { Field, FieldLabel } from "../_ui/field.tsx";
import { Input } from "../_ui/input.tsx";
import { signIn } from "../actions.ts";

export const metadata = { title: "Entrar" };

// Grows as the panel gains protected routes beyond /admin itself. Unmapped
// destinations fall back to the generic phrase below.
const ADMIN_DESTINATION_LABELS: Record<string, string> = {
  "/admin": "ao painel",
  "/admin/pedidos": "aos Pedidos de serviço",
  "/admin/lgpd": "aos Requerimentos LGPD",
  "/admin/ouvidoria": "à Ouvidoria",
  "/admin/agenda": "à Agenda de atendimentos",
  "/admin/atendimento": "ao Atendimento online",
  "/admin/publicacoes": "às Publicações",
  "/admin/configuracoes": "às Configurações",
  "/admin/usuarios": "aos Usuários",
};

function destinationLabel(next: string): string {
  return ADMIN_DESTINATION_LABELS[next] ?? "ao painel";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    next?: string;
    motivo?: string;
    saiu?: string;
    email?: string;
  }>;
}) {
  if (await getSession()) redirect("/admin");
  // Password already right: the e-mail code is what is missing.
  if (await getPendingSession()) redirect("/admin/acesso");
  const { erro, next, motivo, saiu, email } = await searchParams;
  const tenant = await getTenant();
  const destination = next ?? "/admin";
  const limited = erro === "limite";

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* The office's seal (the light one) and name, on the sidebar's light
          tint: the same mark the panel shows once inside. */}
      <div className="flex flex-none flex-col justify-between gap-10 border-sidebar-border bg-sidebar px-6 py-10 text-sidebar-foreground max-md:border-b md:w-105 md:border-r md:px-12 md:py-14 lg:w-120">
        <div>
          <OfficeMark tenant={tenant} />
          <p className="mt-1 pl-11.5 text-xs text-sidebar-label">
            {tenant.subtitle}
          </p>
        </div>

        <div>
          <h1 className="text-2xl leading-tight font-semibold text-foreground">
            Painel administrativo da serventia
          </h1>
          <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-sidebar-label">
            Pedidos de serviço, agenda, requerimentos LGPD, ouvidoria e
            atendimento online: tudo que o cidadão manda pelo site chega aqui.
          </p>
        </div>

        <p className="text-xs text-sidebar-label">
          Acesso restrito à equipe da serventia. Cada entrada fica registrada no
          log de auditoria.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="flex w-full max-w-100 flex-col gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o e-mail e a senha da sua conta do painel.
            </p>
          </div>

          {limited && (
            <p
              role="alert"
              data-admin-banner="limite"
              className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm font-medium text-warning-text"
            >
              Muitas tentativas. Aguarde um instante e tente de novo.
            </p>
          )}
          {!limited && erro === "1" && (
            <p
              role="alert"
              data-admin-banner="erro"
              className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
            >
              E-mail ou senha inválidos.
            </p>
          )}
          {!limited && erro !== "1" && motivo === "expirada" && (
            <output
              data-admin-banner="expirada"
              className="block rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text"
            >
              Sua sessão terminou. Entre de novo para voltar{" "}
              {destinationLabel(destination)}.
            </output>
          )}
          {!limited &&
            erro !== "1" &&
            motivo !== "expirada" &&
            saiu === "1" && (
              <output
                data-admin-banner="saiu"
                className="flex items-center gap-3"
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-full bg-success">
                  <AdminIcon
                    name="check"
                    className="h-4.5 w-4.5 text-success-foreground"
                  />
                </span>
                <p className="text-sm font-medium text-success-text">
                  Você saiu do painel.
                </p>
              </output>
            )}

          <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
            <form action={signIn} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={destination} />
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={email ?? ""}
                />
              </Field>
              <PasswordField
                label="Senha"
                name="password"
                autoComplete="current-password"
              />
              <SubmitButton
                label="Entrar"
                pendingLabel="Entrando…"
                blocked={limited}
                blockedLabel="Aguarde…"
              />
            </form>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Esqueceu a senha?{" "}
            <Link
              href="/admin/esqueci-senha"
              className="font-medium text-primary underline underline-offset-4"
            >
              Peça um link de nova senha
            </Link>
            . Ainda não tem conta? Fale com quem responde pela serventia: o
            registrador envia o convite de acesso pela tela de Usuários.
          </p>
        </div>
      </div>
    </main>
  );
}
