"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_ui/button.tsx";
import {
  type PrenotationSwitchState,
  savePrenotationChargeAction,
} from "./actions.ts";

export interface PrenotationPriceRow {
  label: string;
  /** "R$ 57,90 (código 2600103)", or null when the table has no item. */
  price: string | null;
}

/**
 * "Cobrar a prenotação no pedido" (decision of 22/11/2026): on, a pedido of
 * Registro de Imóveis, Títulos e Documentos or Pessoas Jurídicas waits for
 * the prenotação's payment before the analysis; off, it goes as before.
 */
export function PrenotationSwitch({
  enabled,
  canEdit,
  prices,
  changedLabel,
}: {
  enabled: boolean;
  canEdit: boolean;
  prices: PrenotationPriceRow[];
  changedLabel: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [state, action, pending] = useActionState<
    PrenotationSwitchState,
    FormData
  >(savePrenotationChargeAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "saved") {
      toast.success(
        state.enabled
          ? "Cobrança da prenotação ligada."
          : "Cobrança da prenotação desligada.",
      );
    }
    if (state.status === "error") {
      toast.error(state.message);
      setOn(enabled);
    }
  }, [state, enabled]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Cobrar a prenotação no pedido
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ligado: nos atos de Registro de Imóveis, Títulos e Documentos e
          Pessoas Jurídicas, logo depois do requerimento (pelo site ou no
          balcão) o pedido vai para Aguardando pagamento com o valor da
          prenotação da tabela vigente. Só depois do pagamento conferido ele vai
          para a análise; depois vem a exigência ou o resultado positivo e o
          valor do ato. Desligado: o pedido é analisado antes, sem cobrar nada,
          como era.
        </p>
      </div>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          name="enabled"
          checked={on}
          disabled={!canEdit || pending}
          onChange={(e) => setOn(e.target.checked)}
          className="size-5 accent-primary"
        />
        {on ? "Ligado: cobrar a prenotação antes da análise" : "Desligado"}
      </label>
      <ul className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        {prices.map((row) => (
          <li key={row.label}>
            <strong>{row.label}:</strong>{" "}
            {row.price ?? (
              <span className="text-warning-text">
                sem item de prenotação na tabela vigente
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Os valores vêm sempre da tabela de emolumentos vigente em Transparência.
        Quando a tabela muda, os pedidos que ainda não pagaram passam sozinhos
        para o valor novo; o valor antigo fica no histórico do pedido e na
        auditoria.
        {changedLabel ? ` Última alteração desta opção: ${changedLabel}.` : ""}
      </p>
      {canEdit ? (
        <Button type="submit" disabled={pending || on === enabled}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Só o Tabelião (ou quem cuida da cobrança) altera esta opção.
        </p>
      )}
    </form>
  );
}
