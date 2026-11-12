import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { OfficeMark } from "../_components/sidebar.tsx";
import { SubmitButton } from "../_components/submit-button.tsx";
import { Field, FieldLabel } from "../_ui/field.tsx";
import { Input } from "../_ui/input.tsx";
import { requestPasswordReset } from "./actions.ts";

export const metadata = { title: "Pedir nova senha" };

/**
 * The login screen's own layout, same column with the office on the left: this
 * is the login, one step sideways, and a different shell would read like a
 * different site at the exact moment someone is worried about their access.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; erro?: string }>;
}) {
  if (await getSession()) redirect("/admin");
  const { enviado, erro } = await searchParams;
  const tenant = await getTenant();
  const limited = erro === "limite";

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <div className="flex flex-none flex-col justify-between gap-10 border-sidebar-border bg-sidebar px-6 py-10 text-sidebar-foreground max-md:border-b md:w-105 md:border-r md:px-12 md:py-14 lg:w-120">
        <div>
          <OfficeMark tenant={tenant} />
          <p className="mt-1 pl-11.5 text-xs text-sidebar-label">
            {tenant.subtitle}
          </p>
        </div>

        <div>
          <h1 className="text-2xl leading-tight font-semibold text-foreground">
            Recuperar o acesso ao painel
          </h1>
          <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-sidebar-label">
            O link chega no e-mail da sua conta e vale por 48 horas. Ao criar a
            nova senha, você já entra no painel.
          </p>
        </div>

        <p className="text-xs text-sidebar-label">
          Acesso restrito à equipe da serventia. Cada entrada fica registrada no
          log de auditoria.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="flex w-full max-w-100 flex-col gap-4">
          {enviado === "1" ? (
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
              <span className="flex size-10 items-center justify-center rounded-full bg-success">
                <AdminIcon
                  name="check"
                  className="h-5 w-5 text-success-foreground"
                />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Pedido registrado
                </h2>
                {/*
                  The one sentence this screen may say. It never confirms the
                  address has an account: see requestPasswordReset.
                */}
                <p
                  data-admin-banner="enviado"
                  className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
                >
                  Se existe uma conta ativa com esse e-mail nesta serventia, o
                  link de nova senha acabou de sair. Confira também a caixa de
                  spam.
                </p>
              </div>
              <Link
                href="/admin/login"
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Pedir nova senha
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe o e-mail da sua conta do painel.
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

              <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
                <form
                  action={requestPasswordReset}
                  className="flex flex-col gap-4"
                >
                  <Field>
                    <FieldLabel htmlFor="email">E-mail</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                    />
                  </Field>
                  <SubmitButton
                    label="Enviar link de nova senha"
                    pendingLabel="Enviando…"
                    blocked={limited}
                    blockedLabel="Aguarde…"
                  />
                </form>
              </div>

              <Link
                href="/admin/login"
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Voltar para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
