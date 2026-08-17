"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "../../_components/icon.tsx";
import { type CancelState, cancelByToken } from "./actions.ts";

/**
 * Shows the appointment and asks once. The citizen who clicked the link from
 * an inbox on a phone should be able to see they are cancelling the right
 * morning before anything happens.
 */
export function CancelConfirmation({
  token,
  when,
  serviceLabel,
  citizenName,
}: {
  token: string;
  when: string;
  serviceLabel: string;
  citizenName: string;
}) {
  const [state, formAction, pending] = useActionState<CancelState, FormData>(
    cancelByToken,
    { status: "idle" },
  );

  if (state.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-card p-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint">
          <Icon
            name="check"
            className="h-6 w-6 text-brand-accent"
            strokeWidth={2.2}
          />
        </span>
        <h1 className="mt-3 font-serif text-[22px] font-semibold text-brand-primary">
          Agendamento cancelado
        </h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-[13px] leading-relaxed text-brand-muted">
          O horário de {when} foi liberado para outra pessoa. Se ainda precisar
          do atendimento, escolha um novo horário quando quiser.
        </p>
        <div className="mt-5 flex flex-col gap-2 md:flex-row md:justify-center">
          <Link href="/agendar" className="btn btn-primary btn-lg">
            Escolher outro horário
          </Link>
          <Link href="/" className="btn btn-secondary btn-lg">
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card p-6">
      <h1 className="font-serif text-[22px] font-semibold text-brand-primary">
        Cancelar este agendamento?
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted">
        O horário volta a ficar disponível para outra pessoa assim que você
        confirmar.
      </p>

      <dl className="mt-4 flex flex-col gap-2.5 rounded-xl bg-brand-surface px-4 py-3.5">
        {[
          ["Quando", when],
          ["Serviço", serviceLabel],
          ["Em nome de", citizenName],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-faint">
              {label}
            </dt>
            <dd className="text-[13.5px] font-semibold text-brand-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-brand-alert px-3.5 py-3 text-[13px] font-semibold text-brand-alert"
        >
          {state.message}
        </p>
      )}

      <form
        action={formAction}
        className="mt-5 flex flex-col gap-2 md:flex-row"
      >
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-lg md:flex-1"
        >
          {pending ? "Cancelando..." : "Sim, cancelar o agendamento"}
        </button>
        <Link href="/" className="btn btn-secondary btn-lg md:shrink-0">
          Manter o horário
        </Link>
      </form>
    </div>
  );
}
