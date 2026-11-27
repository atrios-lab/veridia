"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { openProtocolVolumesAction, type RiState } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };
const ROWS = [0, 1, 2, 3];

/**
 * Opens the volumes of the Livro 1 (1, 1-A, 1-B…) from their números: the
 * dates come from the títulos already in the Protocolo.
 */
export function ProtocolVolumesForm() {
  const [state, dispatch, pending] = useActionState(
    openProtocolVolumesAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-medium">Livro</th>
              <th className="pb-1 font-medium">Do nº</th>
              <th className="pb-1 font-medium">Ao nº (vazio: em uso)</th>
              <th className="pb-1 font-medium">Forma</th>
              <th className="pb-1 font-medium">Folhas</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input
                    name={`livro-${i}`}
                    aria-label={`Livro, linha ${i + 1}`}
                    placeholder={i === 0 ? "1" : `1-${"ABC"[i - 1]}`}
                    className="w-20 bg-background"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    name={`de-${i}`}
                    inputMode="numeric"
                    aria-label={`Primeiro número, linha ${i + 1}`}
                    className="w-24 bg-background"
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    name={`ate-${i}`}
                    inputMode="numeric"
                    aria-label={`Último número, linha ${i + 1}`}
                    className="w-24 bg-background"
                  />
                </td>
                <td className="py-1 pr-2">
                  <NativeSelect
                    name={`forma-${i}`}
                    aria-label={`Forma, linha ${i + 1}`}
                    defaultValue="folhas"
                  >
                    <option value="folhas">Folhas (físico)</option>
                    <option value="hibrido">
                      Híbrido (eletrônico e impresso)
                    </option>
                    <option value="eletronico">Meio eletrônico</option>
                  </NativeSelect>
                </td>
                <td className="py-1">
                  <Input
                    name={`folhas-${i}`}
                    inputMode="numeric"
                    aria-label={`Número de folhas, linha ${i + 1}`}
                    className="w-20 bg-background"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Abrindo..." : "Abrir os livros"}
        </Button>
      </div>
      {state.status !== "idle" && (
        <output
          className={`block text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.message}
        </output>
      )}
      <p className="text-xs text-muted-foreground">
        Diga só os números de cada livro. A data de abertura sai do primeiro
        título lançado nele e a de encerramento, do último. O livro em uso fica
        aberto. Livro que já está aberto fica como está. Depois, ajuste datas e
        folhas em Livros e assinatura, se o termo do livro físico disser outra
        coisa.
      </p>
    </form>
  );
}
