"use client";

import { useActionState } from "react";
import type { PagingSettings } from "@/core/ri/protocol-sheets.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { type RiState, saveBookPagingAction } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** Where the system begins the folhas of the Livro 1, and how. */
export function ProtocolPagingForm({
  bookId,
  value,
  suggestedItem,
}: {
  bookId: string;
  value: PagingSettings;
  suggestedItem: number | null;
}) {
  const [state, dispatch, pending] = useActionState(saveBookPagingAction, IDLE);
  useRiToast(state);
  const id = (k: string) => `paging-${bookId}-${k}`;
  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={bookId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("item")}>A partir do nº de ordem</Label>
          <Input
            id={id("item")}
            name="fromItem"
            inputMode="numeric"
            defaultValue={value.fromItem ?? suggestedItem ?? ""}
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("sheet")}>Começa na folha</Label>
          <Input
            id={id("sheet")}
            name="fromSheet"
            inputMode="numeric"
            defaultValue={value.fromSheet}
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("side")}>Face</Label>
          <NativeSelect
            id={id("side")}
            name="fromSide"
            defaultValue={value.fromSide}
          >
            <option value="frente">Frente</option>
            <option value="verso">Verso</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("both")}>Impressão</Label>
          <NativeSelect
            id={id("both")}
            name="bothSides"
            defaultValue={value.bothSides ? "sim" : "nao"}
          >
            <option value="sim">Frente e verso</option>
            <option value="nao">Só a frente</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("lines")}>Linhas para cada título</Label>
          <NativeSelect
            id={id("lines")}
            name="entryLines"
            defaultValue={String(value.entryLines)}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} linhas{n === 3 ? " (como no livro)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={id("day")}>Depois do termo do dia</Label>
          <NativeSelect
            id={id("day")}
            name="dayBreak"
            defaultValue={value.dayBreak}
          >
            <option value="continuo">Continua na mesma folha</option>
            <option value="dia">Cada dia começa em face nova</option>
          </NativeSelect>
        </div>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Salvar as folhas"}
        </Button>
      </div>
      {state.status !== "idle" && (
        <output
          className={`block text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {state.message}
        </output>
      )}
    </form>
  );
}
