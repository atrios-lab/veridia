"use client";

import { upload } from "@vercel/blob/client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import {
  type FileState,
  removeAttributionFileAction,
  uploadAttributionFileAction,
} from "./actions.ts";

const IDLE: FileState = { status: "idle" };

/**
 * Sends one file of any kind to an attribution. In the deploy it goes
 * straight to the store (it may be a whole book's base) and the action gets
 * its address; in development, the form carries it.
 */
export function AttributionUploadForm({
  attribution,
  folder,
  direct,
}: {
  attribution: string;
  folder: string;
  direct: boolean;
}) {
  const [state, action, pending] = useActionState<FileState, FormData>(
    uploadAttributionFileAction,
    IDLE,
  );
  const [sending, startSending] = useTransition();
  const [note, setNote] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "saved") form.current?.reset();
  }, [state]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!direct) return;
    event.preventDefault();
    const current = event.currentTarget;
    const file = (
      current.elements.namedItem("arquivo") as HTMLInputElement | null
    )?.files?.[0];
    if (!file) {
      setNote("Escolha o arquivo.");
      return;
    }
    setNote("");
    const description = String(new FormData(current).get("descricao") ?? "");
    startSending(async () => {
      try {
        const blob = await upload(
          `${folder}${attribution}/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`,
          file,
          {
            access: "public",
            contentType: "application/octet-stream",
            handleUploadUrl: "/api/atribuicoes/upload",
            multipart: file.size > 20 * 1024 * 1024,
          },
        );
        const data = new FormData();
        data.set("atribuicao", attribution);
        data.set("url", blob.url);
        data.set("nome", file.name);
        data.set("descricao", description);
        action(data);
      } catch {
        setNote("Não foi possível enviar o arquivo agora. Tente de novo.");
      }
    });
  };

  const busy = pending || sending;
  const message = note || (state.status === "error" ? state.message : "");
  return (
    <form
      ref={form}
      action={action}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="atribuicao" value={attribution} />
      <FilePicker
        name="arquivo"
        accept=""
        required
        label="Arquivo"
        hint="Qualquer formato: livro ou índice exportado do sistema, remessa ou retorno de central (XML, JSON, texto), PDF, imagem digitalizada, modelo em Word ou RTF, pacote .zip ou .rar."
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`descricao-${attribution}`}>
          Do que se trata (opcional)
        </Label>
        <Input
          id={`descricao-${attribution}`}
          name="descricao"
          maxLength={500}
          placeholder="Por exemplo: Livro 2, matrículas de 1 a 500"
        />
      </div>
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="text-sm font-semibold text-success-text">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? "Enviando..." : "Enviar arquivo"}
      </Button>
    </form>
  );
}

export function RemoveAttributionFileButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FileState, FormData>(
    removeAttributionFileAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este arquivo da lista?"
      consequence="Ele sai da lista e continua guardado, com a justificativa, na auditoria."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** A checklist to follow while doing an act: nothing is saved. */
export function RoutineChecklist({
  id,
  items,
}: {
  id: string;
  items: readonly string[];
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item}>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="checkbox-admin mt-0.5"
                checked={done.has(index)}
                onChange={() =>
                  setDone((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                aria-describedby={`${id}-count`}
              />
              <span className="text-justify hyphens-auto">{item}</span>
            </label>
          </li>
        ))}
      </ol>
      <p id={`${id}-count`} className="text-xs text-muted-foreground">
        {done.size === items.length
          ? "Tudo conferido."
          : `${done.size} de ${items.length} conferidos. A marcação não fica salva: serve para seguir o roteiro na hora do ato.`}
      </p>
    </div>
  );
}
