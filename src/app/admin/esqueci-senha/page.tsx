import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { SubmitButton } from "../_components/submit-button.tsx";
import { requestPasswordReset } from "./actions.ts";

export const metadata = { title: "Pedir nova senha" };

/**
 * The login screen's own layout, same institutional panel on the left: this
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
      <div className="flex flex-none flex-col justify-between gap-10 bg-admin-primary px-6 py-10 text-white md:w-[420px] md:px-12 md:py-14 lg:w-[480px]">
        <div className="flex items-center gap-3">
          <Image
            src={tenant.logos.seal.dark}
            alt=""
            width={44}
            height={44}
            priority
            className="h-11 w-11 object-contain"
          />
          <span>
            <span className="block font-serif text-lg font-semibold text-white">
              {tenant.name}
            </span>
            <span className="block text-[11px] uppercase tracking-[0.08em] text-admin-on-dark-subtitle">
              {tenant.subtitle}
            </span>
          </span>
        </div>

        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-tight text-white md:text-[34px]">
            Recuperar o acesso ao painel
          </h1>
          <p className="mt-3.5 max-w-[38ch] text-sm leading-relaxed text-admin-on-dark-subtitle">
            O link chega no e-mail da sua conta e vale por 48 horas. Ao criar a
            nova senha, você já entra no painel.
          </p>
        </div>

        <p className="text-xs text-admin-on-dark-muted">
          Acesso restrito à equipe da serventia. Cada entrada fica registrada no
          log de auditoria.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-admin-card-surface px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          {enviado === "1" ? (
            <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-primary-soft">
                <AdminIcon name="check" className="h-5 w-5 text-white" />
              </span>
              <div>
                <h2 className="font-serif text-xl font-semibold text-admin-primary">
                  Pedido registrado
                </h2>
                {/*
                  The one sentence this screen may say. It never confirms the
                  address has an account: see requestPasswordReset.
                */}
                <p
                  data-admin-banner="enviado"
                  className="mt-1.5 text-sm leading-relaxed text-admin-muted"
                >
                  Se existe uma conta ativa com esse e-mail nesta serventia, o
                  link de nova senha acabou de sair. Confira também a caixa de
                  spam.
                </p>
              </div>
              <Link
                href="/admin/login"
                className="text-sm font-semibold text-admin-primary underline"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h2 className="font-serif text-2xl font-semibold text-admin-primary">
                  Pedir nova senha
                </h2>
                <p className="mt-1 text-sm text-admin-muted">
                  Informe o e-mail da sua conta do painel.
                </p>
              </div>

              {limited && (
                <p
                  role="alert"
                  data-admin-banner="limite"
                  className="rounded-lg bg-admin-warning-bg px-3.5 py-2.5 text-sm font-semibold text-admin-warning-text"
                >
                  Muitas tentativas. Aguarde um instante e tente de novo.
                </p>
              )}

              <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
                <form
                  action={requestPasswordReset}
                  className="flex flex-col gap-3.5"
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-xs font-bold text-admin-primary"
                    >
                      E-mail
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="username"
                      className="w-full rounded-lg border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-sm text-admin-text outline-none"
                    />
                  </div>
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
                className="text-xs font-semibold text-admin-faint underline"
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
