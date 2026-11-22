"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../_ui/button.tsx";
import { type ImportMetaState, setPublicLookupAction } from "./actions.ts";

/**
 * "Seu registro é daqui?" in the panel: the switch, and the latest lookups
 * made on the site (who asked, why, what, and whether it was found).
 */
export function PublicLookupCard({
  enabled,
  canEdit,
  lookups,
}: {
  enabled: boolean;
  canEdit: boolean;
  lookups: { at: string; text: string }[];
}) {
  const [on, setOn] = useState(enabled);
  const [state, action, pending] = useActionState(setPublicLookupAction, {
    status: "idle",
  } as ImportMetaState);
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
    if (state.status === "error") {
      toast.error(state.message);
      setOn(enabled);
    }
  }, [state, enabled]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Consulta pelo site: “Seu registro é daqui?”
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Com o nome completo e o nome completo da mãe (a data de nascimento é
          opcional), o site diz na hora se o registro está no índice e a
          profissão que consta nele, dizendo de quem é. Não mostra CPF,
          documentos, livro nem folha. Quem consulta informa nome, CPF e
          finalidade, e cada consulta fica registrada abaixo e na auditoria.
          Endereço: <strong>/consulta-registro</strong>.
        </p>
      </div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            checked={on}
            disabled={!canEdit || pending}
            onChange={(e) => setOn(e.target.checked)}
            className="size-5 accent-primary"
          />
          {on ? "Ligada no site" : "Desligada"}
        </label>
        {canEdit && (
          <Button type="submit" size="sm" disabled={pending || on === enabled}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        )}
        {on && (
          <a
            href="/consulta-registro"
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir a consulta no site
          </a>
        )}
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          Consultas feitas pelo site ({lookups.length})
        </summary>
        {lookups.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nenhuma consulta ainda.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {lookups.map((lookup) => (
              <li
                key={`${lookup.at}-${lookup.text}`}
                className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-foreground"
              >
                <span className="font-semibold">{lookup.at}</span> ·{" "}
                {lookup.text}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
