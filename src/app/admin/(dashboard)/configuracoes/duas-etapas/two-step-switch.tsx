"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type AccessState, setOfficeTwoStep } from "./actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";

/**
 * On or off for the whole office: off, the panel asks only for the
 * password (an e-mail outage, a code that does not arrive), until it is
 * turned on again. Who changed it, when and why stay in the audit.
 */
export function TwoStepSwitch({
  enabled,
  changedLine,
}: {
  enabled: boolean;
  /** "Desligada em 11/11/2026, 10:20: motivo", when it was changed. */
  changedLine: string | null;
}) {
  const [state, action, pending] = useActionState<AccessState, FormData>(
    setOfficeTwoStep,
    { status: "idle" },
  );
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (state.status === "saved") {
      toast.success(state.message);
      setAsking(false);
    }
  }, [state]);

  return (
    <section
      className={`rounded-[14px] border px-5 py-4 ${enabled ? "border-admin-border bg-admin-card" : "border-admin-warning-soft-border bg-admin-warning-bg"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
            {enabled
              ? "Duas etapas: ligada"
              : "Duas etapas: desligada (só senha)"}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-admin-muted">
            {enabled
              ? "Se o código não estiver chegando por e-mail, desligue aqui. Ligue de novo assim que voltar ao normal."
              : "O painel está pedindo só a senha. Ligue de novo assim que o e-mail voltar ao normal."}
          </p>
          {changedLine && (
            <p className="mt-1 text-[12px] text-admin-muted">{changedLine}</p>
          )}
        </div>
        {enabled ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="btn btn-admin-secondary btn-md"
            aria-expanded={asking}
          >
            Desligar
          </button>
        ) : (
          <form action={action}>
            <input type="hidden" name="twoStep" value="on" />
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-md"
            >
              {pending ? "Ligando..." : "Ligar de novo"}
            </button>
          </form>
        )}
      </div>
      {enabled && asking && (
        <form action={action} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="twoStep" value="off" />
          <label className="flex flex-col gap-1.5 text-xs font-bold text-admin-primary">
            Motivo (vai para a auditoria)
            <input
              name="reason"
              required
              placeholder="Ex.: o código não está chegando no e-mail"
              className={`${FIELD} font-normal`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn btn-admin-primary btn-sm"
            >
              {pending ? "Desligando..." : "Desligar as duas etapas"}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="btn btn-admin-secondary btn-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
