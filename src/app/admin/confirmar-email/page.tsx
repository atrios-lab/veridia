import Link from "next/link";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../_components/icon.tsx";
import { SubmitButton } from "../_components/submit-button.tsx";
import { confirmEmailChange } from "./actions.ts";
import { findEmailChange } from "./find-email-change.ts";

export const metadata = { title: "Confirmar e-mail" };

function Card({
  icon,
  tone,
  title,
  children,
}: {
  icon: "clock" | "check" | "alert";
  tone: "warning" | "success" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const bg = {
    warning: "bg-admin-warning-bg",
    success: "bg-admin-success-bg",
    error: "bg-admin-error-bg",
  }[tone];
  const fg = {
    warning: "text-admin-warning-text",
    success: "text-admin-success-text",
    error: "text-admin-error-text",
  }[tone];

  return (
    <main className="flex min-h-screen items-center justify-center bg-admin-surface px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-admin-border bg-admin-card p-6">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full ${bg}`}
          >
            <AdminIcon name={icon} className={`h-5 w-5 ${fg}`} />
          </span>
          <div>
            <h1 className="font-serif text-xl font-semibold text-admin-primary">
              {title}
            </h1>
            <div className="mt-1.5 flex flex-col gap-2 text-sm leading-relaxed text-admin-muted">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Confirms the e-mail change asked for in the panel. Public on purpose, and
 * with no session check either way: whoever needs this page may well be the
 * person who cannot get in, and a registrador who is signed in has no
 * reason to be bounced away from it.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; ok?: string; erro?: string }>;
}) {
  const { token, ok, erro } = await searchParams;

  if (ok === "1") {
    return (
      <Card icon="check" tone="success" title="E-mail alterado">
        <p>
          A conta passa a entrar com o novo endereço. A senha continua a mesma.
        </p>
        <Link
          href="/admin/login"
          className="text-sm font-semibold text-admin-primary underline"
        >
          Entrar no painel
        </Link>
      </Card>
    );
  }

  const tenant = await getTenant();
  const pending = token ? await findEmailChange(token, tenant.slug) : null;

  if (!pending) {
    return (
      <Card icon="clock" tone="warning" title="Este link não vale mais">
        <p>
          Os links de confirmação valem 48 horas, servem uma vez só, e um pedido
          novo cancela o anterior. O e-mail da conta não mudou.
        </p>
        <p className="text-xs text-admin-faint">
          Peça à serventia para refazer a troca: um link novo chega neste mesmo
          endereço.
        </p>
      </Card>
    );
  }

  if (erro === "indisponivel") {
    return (
      <Card icon="alert" tone="error" title="Esse endereço não está mais livre">
        <p>
          Entre o pedido e agora, <strong>{pending.email}</strong> passou a ser
          usado por outra conta. O e-mail da conta continua sendo{" "}
          {pending.previousEmail}.
        </p>
        <p className="text-xs text-admin-faint">
          Fale com quem responde pela serventia para escolher outro endereço.
        </p>
      </Card>
    );
  }

  return (
    <Card icon="check" tone="success" title="Confirmar o novo e-mail">
      <p>
        A serventia pediu para a conta de {pending.name.split(" ")[0]} passar a
        entrar com <strong>{pending.email}</strong>, no lugar de{" "}
        {pending.previousEmail}.
      </p>
      {/* A button and not the page load: link scanners follow every URL in
          an inbox, and one of them completing this would skip the only step
          the whole two-step change exists to make a person take. */}
      <form action={confirmEmailChange} className="mt-1.5">
        <input type="hidden" name="token" value={token} />
        <SubmitButton
          label="Confirmar novo e-mail"
          pendingLabel="Confirmando…"
        />
      </form>
      <p className="text-xs text-admin-faint">
        Até confirmar, a conta continua entrando com o endereço antigo. A senha
        não muda.
      </p>
    </Card>
  );
}
