"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { type RiState, saveAnnotationAction } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** A new anotação, or the change of one (the old text stays in its history). */
export function AnnotationForm({
  propertyId,
  noteId,
  on,
  text,
}: {
  propertyId: string;
  noteId?: string;
  on?: string;
  text?: string;
}) {
  const [state, action, pending] = useActionState(saveAnnotationAction, IDLE);
  useRiToast(state);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "success" && !noteId) form.current?.reset();
  }, [state, noteId]);
  const id = noteId ?? "nova";
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      {noteId && <input type="hidden" name="noteId" value={noteId} />}
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-on-${id}`}>Data</Label>
          <Input
            id={`note-on-${id}`}
            name="on"
            placeholder="dd/mm/aaaa"
            defaultValue={on ?? ""}
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-text-${id}`}>Anotação</Label>
          <Textarea
            id={`note-text-${id}`}
            name="texto"
            rows={2}
            required
            defaultValue={text ?? ""}
            placeholder="Ex.: o mesmo título está registrado no RTD sob nº …; remissão à matrícula nº …"
            className="field-sizing-fixed bg-background"
          />
        </div>
      </div>
      <div>
        <Button
          type="submit"
          size="sm"
          variant={noteId ? "outline" : "default"}
          disabled={pending}
        >
          {pending
            ? "Salvando…"
            : noteId
              ? "Salvar a alteração"
              : "Lançar a anotação"}
        </Button>
      </div>
    </form>
  );
}
