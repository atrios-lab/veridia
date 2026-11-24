"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import {
  type SettingsState,
  saveConclusionPolicyAction,
} from "../setores/actions.ts";

export interface ConclusionPerson {
  id: string;
  name: string;
  roleLabel: string;
  /** The Tabelião/Registrador: always in the list. */
  holder: boolean;
}

/**
 * Who may sign and conclude the pedidos (decision of 24/11/2026): everyone
 * who works the pedidos, or only the people the Tabelião chooses. The
 * others still analyse, execute, check and route; they send it "para
 * assinatura" to one of these.
 */
export function ConclusionForm({
  mode,
  selected,
  people,
}: {
  mode: "all" | "selected";
  selected: string[];
  people: ConclusionPerson[];
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveConclusionPolicyAction,
    { status: "idle" },
  );
  const [choice, setChoice] = useState(mode);
  const [chosen, setChosen] = useState<string[]>(
    selected.length > 0
      ? selected
      : people.filter((p) => p.holder).map((p) => p.id),
  );
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  const option = (value: "all" | "selected", title: string, help: string) => (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${choice === value ? "border-2 border-primary bg-muted/50" : ""}`}
    >
      <input
        type="radio"
        name="mode"
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{help}</span>
      </span>
    </label>
  );

  return (
    <form action={action} className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">
        Quem pode assinar e concluir os pedidos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Todos continuam podendo analisar, executar, conferir e direcionar. Esta
        escolha vale só para o último passo: "Ato praticado: disponibilizar para
        retirada", "Concluir com entrega digital" e responder a busca.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {option(
          "all",
          "Todos da equipe com acesso aos pedidos",
          "Qualquer pessoa que trabalha os pedidos assina e conclui.",
        )}
        {option(
          "selected",
          "Só as pessoas que eu escolher",
          'Os demais direcionam "para assinatura" e quem está na lista conclui.',
        )}
      </div>
      {choice === "selected" && (
        <ul className="mt-3 flex flex-col divide-y rounded-xl border px-4">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  name="userIds"
                  value={person.id}
                  checked={person.holder || chosen.includes(person.id)}
                  disabled={person.holder}
                  onChange={(e) =>
                    setChosen((list) =>
                      e.target.checked
                        ? [...list, person.id]
                        : list.filter((id) => id !== person.id),
                    )
                  }
                  className="size-4 accent-primary"
                />
                <span className="flex-1 text-foreground">{person.name}</span>
                <span className="text-xs text-muted-foreground">
                  {person.roleLabel}
                  {person.holder ? " · sempre na lista" : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
        Cada mudança fica na auditoria, com quem mudou e a lista anterior. A
        assinatura digital continua pedindo o certificado autorizado de cada um.
      </p>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
