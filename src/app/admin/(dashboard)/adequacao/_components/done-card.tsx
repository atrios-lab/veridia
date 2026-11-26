"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  type DoneState,
  saveComplianceDoneAction,
  withdrawComplianceDoneAction,
} from "../actions.ts";

export interface DoneView {
  doneOn: string;
  justicaAberta: boolean;
  justicaAbertaOn: string;
  note: string;
}

const br = (iso: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

/**
 * "Já cumpri" (decision of 22/11/2026): the day the office complied and
 * whether it is in the Justiça Aberta. Marked, the screen and the Visão
 * geral stop showing the intake as pending; editable or undone any time.
 */
export function DoneCard({
  done,
  today,
}: {
  done: DoneView | null;
  today: string;
}) {
  const ids = { on: useId(), ja: useId(), jaOn: useId(), note: useId() };
  const [editing, setEditing] = useState(false);
  const [save, saveAction, saving] = useActionState<DoneState, FormData>(
    saveComplianceDoneAction,
    { status: "idle" },
  );
  const [withdraw, withdrawAction, withdrawing] = useActionState<
    DoneState,
    FormData
  >(withdrawComplianceDoneAction, { status: "idle" });
  const [ja, setJa] = useState(done?.justicaAberta ? "sim" : "nao");

  useEffect(() => {
    if (save.status === "saved") {
      toast.success("Registrado.");
      setEditing(false);
    }
    if (save.status === "error") toast.error(save.message);
  }, [save]);
  useEffect(() => {
    if (withdraw.status === "saved") toast.success("Marcação desfeita.");
  }, [withdraw]);

  if (done && !editing) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success-soft p-5">
        <p className="text-base font-semibold text-success-text">
          Provimento cumprido em {br(done.doneOn)}.
        </p>
        <p className="text-sm text-foreground">
          {done.justicaAberta
            ? `Inserido no Justiça Aberta${done.justicaAbertaOn ? ` em ${br(done.justicaAbertaOn)}` : ""}.`
            : "Ainda falta inserir no Justiça Aberta."}
          {done.note ? ` ${done.note}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
          <ConfirmAction
            action={withdrawAction}
            pending={withdrawing}
            error={withdraw.status === "error" ? withdraw.message : null}
            trigger="Apagar"
            triggerClassName={buttonVariants({
              variant: "destructive",
              size: "sm",
            })}
            question="Desfazer a marcação de cumprido?"
            consequence="A Adequação volta a aparecer como pendente. A marcação fica no histórico e na auditoria."
            confirmLabel="Desfazer"
            pendingLabel="Desfazendo..."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-primary/5 p-5">
      <h2 className="text-base font-semibold text-foreground">
        {done ? "Editar o cumprimento" : "Já cumpriu o Provimento?"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Marque aqui com a data e se já inseriu no Justiça Aberta: a Adequação
        deixa de aparecer como pendente. Dá para editar ou apagar a qualquer
        tempo.
      </p>
      <form action={saveAction} className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.on}>Cumprido em</Label>
          <Input
            id={ids.on}
            name="doneOn"
            type="date"
            required
            max={today}
            defaultValue={done?.doneOn ?? today}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.ja}>Já inseriu no Justiça Aberta?</Label>
          <NativeSelect
            id={ids.ja}
            name="justicaAberta"
            value={ja}
            onChange={(e) => setJa(e.target.value)}
          >
            <NativeSelectOption value="sim">Sim, já inseri</NativeSelectOption>
            <NativeSelectOption value="nao">Ainda não</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={ids.jaOn}>Inserido em</Label>
          <Input
            id={ids.jaOn}
            name="justicaAbertaOn"
            type="date"
            disabled={ja !== "sim"}
            max={today}
            defaultValue={done?.justicaAbertaOn ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <Label htmlFor={ids.note}>Observação (opcional)</Label>
          <Input
            id={ids.note}
            name="note"
            maxLength={1000}
            defaultValue={done?.note ?? ""}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : done ? "Salvar alteração" : "Já cumpri"}
          </Button>
          {done && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
