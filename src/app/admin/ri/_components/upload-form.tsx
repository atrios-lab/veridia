"use client";

import { upload } from "@vercel/blob/client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { type RiState, uploadFileAction } from "../actions.ts";

const IDLE: RiState = { status: "idle" };

const KINDS = [
  ["ficha", "Ficha ou imagem da matrícula"],
  ["titulo", "Título (escritura, mandado, cédula, contrato)"],
  ["documento", "Outro documento"],
] as const;

/**
 * Attaches a file to a matrícula (or, with no matrícula yet, reads one to
 * create it). PDF, Word, photo or scan. With `read`, the assistente virtual
 * reads it and the conferência screen opens.
 */
export function UploadForm({
  propertyId,
  kind = "documento",
  read = false,
  direct,
  folder,
}: {
  propertyId: string;
  /** The office's RI folder in the store (direct uploads only). */
  folder: string;
  kind?: "ficha" | "titulo" | "documento";
  read?: boolean;
  direct: boolean;
}) {
  const [state, action, pending] = useActionState(uploadFileAction, IDLE);
  const [sending, startSending] = useTransition();
  const [note, setNote] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "success") {
      toast.success(state.message);
      form.current?.reset();
    }
  }, [state]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!direct) return;
    event.preventDefault();
    const current = event.currentTarget;
    const data = new FormData(current);
    const file = data.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      setNote("Escolha o arquivo.");
      return;
    }
    setNote("");
    startSending(async () => {
      try {
        const blob = await upload(
          `${data.get("folder")}${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`,
          file,
          {
            access: "public",
            contentType: file.type || "application/octet-stream",
            handleUploadUrl: "/api/ri/upload",
            multipart: file.size > 20 * 1024 * 1024,
          },
        );
        data.delete("arquivo");
        data.set("url", blob.url);
        data.set("nome", file.name);
        data.set("tamanho", String(file.size));
        data.set("tipo", file.type);
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
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="ler" value={read ? "1" : ""} />
      <input type="hidden" name="folder" value={folder} />
      <FilePicker
        name="arquivo"
        accept=".pdf,.doc,.docx,.rtf,.txt,.jpg,.jpeg,.png,.tif,.tiff,image/*,application/pdf"
        label="Arquivo"
        hint="PDF, Word, foto ou digitalização (até 40 MB)."
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor={`kind-${propertyId || "novo"}`}>O que é</label>
          <NativeSelect
            id={`kind-${propertyId || "novo"}`}
            name="kind"
            defaultValue={kind}
          >
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {!read && (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              name="lerAgora"
              value="1"
              className="size-4"
            />
            Ler com o Assistente Virtual depois de anexar
          </label>
        )}
        <Button type="submit" disabled={busy}>
          {busy
            ? read
              ? "Lendo… pode levar um minuto"
              : "Enviando…"
            : read
              ? "Anexar e ler"
              : "Anexar"}
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
    </form>
  );
}
