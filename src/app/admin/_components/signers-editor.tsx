"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "../_ui/button.tsx";
import { Input } from "../_ui/input.tsx";
import {
  type SignersState,
  saveOfficeSigners,
} from "../(dashboard)/configuracoes/quem-assina/actions.ts";
import { AdminIcon } from "./icon.tsx";

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
  const fieldId = useId();
  const [signers, setSigners] = useState<Signer[]>(
    initial.length ? initial : [{ name: "", title: "", note: "" }],
  );

  return (
    <form action={action} className="rounded-xl border bg-card p-6">
      <input type="hidden" name="signers" value={JSON.stringify(signers)} />
      <h2 className="text-lg font-semibold text-foreground">Quem assina</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A mesma lista vale para as guias de transmissão, a Declaração de ISS e a
        declaração de comparecimento. Mudou alguém de cargo ou entrou gente
        nova? Corrija aqui.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {signers.map((signer, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: signers have no id; the index is their identity here.
            key={index}
            className="grid grid-cols-1 gap-3 border-b pb-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            {(["name", "title", "note"] as const).map((key) => (
              <label
                key={key}
                htmlFor={`${fieldId}-${index}-${key}`}
                className="flex flex-col gap-2"
              >
                <span className="text-sm leading-none font-medium">
                  {
                    {
                      name: "Nome",
                      title: "Cargo",
                      note: "Portaria/Matrícula",
                    }[key]
                  }
                </span>
                <Input
                  id={`${fieldId}-${index}-${key}`}
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
                />
              </label>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSigners(signers.filter((_, i) => i !== index))}
              disabled={signers.length <= 1}
              className="self-end text-destructive hover:text-destructive"
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setSigners([...signers, { name: "", title: "", note: "" }])
          }
          className="self-start"
        >
          + Quem assina
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar quem assina"}
        </Button>
        {state.status === "saved" && (
          <output className="flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text">
            <AdminIcon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
            Salvo. Vale para os próximos documentos.
          </output>
        )}
      </div>
    </form>
  );
}
