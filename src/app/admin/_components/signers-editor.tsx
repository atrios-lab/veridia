"use client";

import { useActionState, useState } from "react";
import {
  type SignersState,
  saveOfficeSigners,
} from "../(dashboard)/configuracoes/quem-assina/actions.ts";
import { AdminIcon } from "./icon.tsx";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft";
const LABEL = "mb-1 block text-[11.5px] font-bold text-admin-primary";

export interface Signer {
  name: string;
  title: string;
  note: string;
}

/**
 * "Quem assina", the office's one list (decision of 11/11/2026): the same
 * people for the guias, the Declaração de ISS and the declaração de
 * comparecimento. Anyone who may issue them keeps it current when someone
 * joins, leaves or changes position.
 */
export function SignersEditor({ initial }: { initial: Signer[] }) {
  const [state, action, pending] = useActionState<SignersState, FormData>(
    saveOfficeSigners,
    { status: "idle" },
  );
  const [signers, setSigners] = useState<Signer[]>(
    initial.length ? initial : [{ name: "", title: "", note: "" }],
  );

  return (
    <form
      action={action}
      className="rounded-[14px] border border-admin-border bg-admin-card p-5"
    >
      <input type="hidden" name="signers" value={JSON.stringify(signers)} />
      <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
        Quem assina
      </h2>
      <p className="mt-1 text-[12px] text-admin-muted">
        A mesma lista vale para as guias de transmissão, a Declaração de ISS e a
        declaração de comparecimento. Mudou alguém de cargo ou entrou gente
        nova? Corrija aqui.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {signers.map((signer, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: signers have no id; the index is their identity here.
            key={index}
            className="grid grid-cols-1 gap-3 border-b border-admin-border pb-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            {(["name", "title", "note"] as const).map((key) => (
              <label key={key} className="block">
                <span className={LABEL}>
                  {
                    {
                      name: "Nome",
                      title: "Cargo",
                      note: "Portaria/Matrícula",
                    }[key]
                  }
                </span>
                <input
                  value={signer[key]}
                  onChange={(event) =>
                    setSigners(
                      signers.map((one, i) =>
                        i === index
                          ? { ...one, [key]: event.target.value }
                          : one,
                      ),
                    )
                  }
                  className={FIELD}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => setSigners(signers.filter((_, i) => i !== index))}
              disabled={signers.length <= 1}
              className="self-end pb-2 text-[12px] font-semibold text-admin-alert hover:underline disabled:opacity-40"
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSigners([...signers, { name: "", title: "", note: "" }])
          }
          className="btn btn-admin-secondary btn-md self-start"
        >
          + Quem assina
        </button>
      </div>
      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold text-admin-error-text"
        >
          {state.message}
        </p>
      )}
      <div className="mt-3.5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando…" : "Salvar quem assina"}
        </button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-admin-success-bg px-3 py-1.5 text-[12.5px] font-semibold text-admin-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Vale para os próximos documentos.
          </output>
        )}
      </div>
    </form>
  );
}
