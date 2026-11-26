"use client";

import { useActionState, useEffect, useRef } from "react";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { addGeometryAction, type RiState } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

/** The memorial (pasted or as a file) or the Sigef table, read into vértices. */
export function GeoForm({
  propertyId,
  acts,
}: {
  propertyId: string;
  acts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addGeometryAction, IDLE);
  useRiToast(state);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "success") form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="propertyId" value={propertyId} />
      <FilePicker
        name="arquivo"
        accept=".ods,.xlsx,.csv,.pdf,.docx,.txt"
        label="Planilha do Sigef ou memorial descritivo"
        hint="A planilha de vértices do Sigef (.ods, .xlsx ou .csv) ou o memorial em PDF, Word ou texto."
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`geo-memorial-${propertyId}`}>Ou cole o memorial</Label>
        <Textarea
          id={`geo-memorial-${propertyId}`}
          name="memorial"
          rows={4}
          placeholder="Inicia-se a descrição deste perímetro no vértice ..., de coordenadas N ... m e E ... m; ..."
          className="field-sizing-fixed bg-background"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`geo-sigef-${propertyId}`}>
            Certificação Sigef (código da parcela)
          </Label>
          <Input
            id={`geo-sigef-${propertyId}`}
            name="sigef"
            className="bg-background"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`geo-act-${propertyId}`}>
            Ato da matrícula (averbação)
          </Label>
          <NativeSelect
            id={`geo-act-${propertyId}`}
            name="actId"
            defaultValue=""
          >
            <option value="">Nenhum</option>
            {acts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Lendo os vértices…" : "Ler e desenhar o perímetro"}
        </Button>
      </div>
    </form>
  );
}
