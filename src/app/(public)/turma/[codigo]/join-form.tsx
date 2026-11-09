"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "../../_components/icon.tsx";
import { type JoinState, joinCohortAction } from "./actions.ts";

const inputClass =
  "w-full rounded-xl border border-brand-border bg-brand-surface px-3.5 py-3 text-sm text-brand-text outline-none placeholder:text-brand-faint focus:border-brand-accent";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-brand-primary";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-semibold text-brand-alert">
      {message}
    </p>
  );
}

export function JoinForm({
  code,
  loginHref,
}: {
  code: string;
  loginHref: string;
}) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(
    joinCohortAction.bind(null, code),
    { status: "idle" },
  );
  const errors = state.status === "error" ? state.fieldErrors : {};
  const values = state.status === "error" ? state.values : undefined;

  if (state.status === "error" && state.closed) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="fullName" className={labelClass}>
          Nome completo
        </label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={values?.fullName}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
          className={inputClass}
        />
        <FieldError id="fullName-error" message={errors.fullName} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={inputClass}
        />
        <FieldError id="email-error" message={errors.email} />
        {state.status === "error" && state.emailTaken && (
          <p className="mt-1.5 text-xs text-brand-muted">
            Se a conta é sua,{" "}
            <Link href={loginHref} className="font-semibold underline">
              entre por aqui
            </Link>
            .
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Crie uma senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "password-error" : "password-hint"
          }
          className={inputClass}
        />
        {errors.password ? (
          <FieldError id="password-error" message={errors.password} />
        ) : (
          <p id="password-hint" className="mt-1.5 text-xs text-brand-muted">
            Pelo menos 8 caracteres. Você vai usar para voltar ao curso.
          </p>
        )}
      </div>

      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-brand-text">
        <input
          type="checkbox"
          name="contactConsent"
          defaultChecked={values?.contactConsent ?? false}
          className="mt-1 h-4 w-4 shrink-0 accent-brand-primary"
        />
        <span>
          Aceito receber contato da Átrios sobre a plataforma de atendimento
          para cartórios.{" "}
          <span className="text-brand-muted">
            Opcional. Você pode pedir para parar quando quiser.
          </span>
        </span>
      </label>

      <div className="flex items-start gap-2.5 rounded-xl bg-brand-tint px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-primary">
        <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Seu nome e seu e-mail servem para criar a sua conta, guardar o seu
          progresso e emitir o certificado. Quem cuida desses dados é a Átrios.
          O CPF só é pedido no fim, para o certificado. Se você marcou a caixa
          acima, o e-mail também pode ser usado para falarmos da plataforma.
        </p>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary btn-lg w-full md:w-auto md:self-start md:px-7"
      >
        {pending ? "Criando a conta..." : "Criar conta e começar"}
      </button>
    </form>
  );
}
