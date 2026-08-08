import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { PasswordField } from "../_components/password-field.tsx";
import { signIn } from "../actions.ts";

export const metadata = { title: "Entrar" };

// Grows as the panel gains protected routes beyond /admin itself (Entrega 6
// em diante). Unmapped destinations fall back to the generic phrase below.
const ADMIN_DESTINATION_LABELS: Record<string, string> = {
  "/admin": "ao painel",
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
  }>;
}) {
  if (await getSession()) redirect("/admin");
  const { erro, next, motivo, saiu } = await searchParams;
  const tenant = await getTenant();
  const destination = next ?? "/admin";
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
            Painel administrativo da serventia
          </h1>
          <p className="mt-3.5 max-w-[38ch] text-sm leading-relaxed text-admin-on-dark-subtitle">
            Pedidos de serviço, agenda, requerimentos LGPD, ouvidoria e
            atendimento online: tudo que o cidadão manda pelo site chega aqui.
          </p>
        </div>

        <p className="text-xs text-admin-on-dark-muted">
          Acesso restrito à equipe da serventia. Cada entrada fica registrada no
          log de auditoria.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-admin-card-surface px-6 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-admin-primary">
              Entrar
            </h2>
            <p className="mt-1 text-sm text-admin-muted">
              Use o e-mail e a senha da sua conta do painel.
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
          {!limited && erro === "1" && (
            <p
              role="alert"
              data-admin-banner="erro"
              className="rounded-lg bg-admin-error-bg px-3.5 py-2.5 text-sm font-semibold text-admin-error-text"
            >
              E-mail ou senha inválidos.
            </p>
          )}
          {!limited && erro !== "1" && motivo === "expirada" && (
            <output
              data-admin-banner="expirada"
              className="block rounded-lg bg-admin-success-bg px-3.5 py-2.5 text-sm font-semibold text-admin-success-text"
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
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-admin-primary-soft">
                  <AdminIcon name="check" className="h-4.5 w-4.5 text-white" />
                </span>
                <p className="text-sm font-semibold text-admin-success-text">
                  Você saiu do painel.
                </p>
              </output>
            )}

          <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
            <form action={signIn} className="flex flex-col gap-3.5">
              <input type="hidden" name="next" value={destination} />
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
                  className="w-full rounded-lg border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-sm text-admin-text outline-none"
                />
              </div>
              <PasswordField
                label="Senha"
                name="password"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={limited}
                className="mt-1 rounded-lg bg-admin-primary-soft px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {limited ? "Aguarde…" : "Entrar"}
              </button>
            </form>
          </div>

          <p className="text-xs leading-relaxed text-admin-faint">
            Esqueceu a senha ou ainda não tem conta? Fale com quem responde pela
            serventia: o registrador reenvia o convite de acesso pela tela de
            Usuários.
          </p>
        </div>
      </div>
    </main>
  );
}
