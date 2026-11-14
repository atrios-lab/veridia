"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useState, useTransition } from "react";
import { RCPN_MAX_BYTES, RCPN_MAX_MB } from "@/core/rcpn/limits.ts";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import {
  type CloseState,
  discardImportAction,
  publishImportAction,
  type UploadState,
  uploadImportAction,
} from "./actions.ts";

const IDLE = { status: "idle" } as const;

/**
 * Sends one file, of any kind, exported from the registry system. In the
 * deploy the file goes straight to the store (it may be the whole base) and
 * the action receives its address; in development, the form carries it.
 */
export function UploadForm({
  direct,
  folder,
}: {
  direct: boolean;
  folder: string;
}) {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadImportAction,
    IDLE,
  );
  const [sending, startSending] = useTransition();
  const [note, setNote] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!direct) return;
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("arquivo") as HTMLInputElement | null)
      ?.files?.[0];
    if (!file) {
      setNote("Escolha o arquivo exportado do sistema do registro civil.");
      return;
    }
    if (file.size > RCPN_MAX_BYTES) {
      setNote(
        `O arquivo é muito grande (${Math.ceil(file.size / 1024 / 1024)} MB). O máximo por envio é ${RCPN_MAX_MB} MB: compacte em .zip ou envie cada banco separado.`,
      );
      return;
    }
    setNote("");
    startSending(async () => {
      try {
        const blob = await upload(
          `${folder}${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`,
          file,
          {
            access: "public",
            contentType: "application/octet-stream",
            handleUploadUrl: "/api/rcpn/upload",
            multipart: file.size > 20 * 1024 * 1024,
          },
        );
        const data = new FormData();
        data.set("url", blob.url);
        data.set("fileName", file.name);
        action(data);
      } catch {
        setNote("Não foi possível enviar o arquivo agora. Tente de novo.");
      }
    });
  };

  const busy = pending || sending;
  const message = note || (state.status === "error" ? state.message : "");
  return (
    <form action={action} onSubmit={onSubmit} className="flex flex-col gap-4">
      <FilePicker
        name="arquivo"
        accept=""
        required
        label="Arquivo do sistema do registro civil"
        hint={`Até ${RCPN_MAX_MB} MB por envio. Qualquer formato: banco do Cartosoft (.mdb), carga XML, pacote .zip ou .rar com vários arquivos (recomendado para arquivos grandes). O sistema lê o que conhece e guarda o resto.`}
      />
      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy} className="self-start">
        {busy ? "Enviando e lendo o arquivo..." : "Enviar e ler o arquivo"}
      </Button>
    </form>
  );
}

export interface ChangedItem {
  key: string;
  label: string;
  changes: string[];
  /** Corrected by hand in the panel. */
  edited?: boolean;
}

/**
 * The publication: the new registros go in; each changed one only if the
 * person marks it (decision of 14/11/2026: "avise e pergunte se deseja
 * substituir").
 */
export function PublishForm({
  id,
  newCount,
  changed,
  changedTotal = changed.length,
  editedTotal = 0,
}: {
  id: string;
  newCount: number;
  /** The first changed registros, to mark one by one. */
  changed: ChangedItem[];
  /** All the changed ones, including those not on the screen. */
  changedTotal?: number;
  /** Of the changed ones, those corrected by hand in the panel. */
  editedTotal?: number;
}) {
  const [state, action, pending] = useActionState<CloseState, FormData>(
    publishImportAction,
    IDLE,
  );
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const all = changed.length > 0 && marked.size === changed.length;
  const [everything, setEverything] = useState(false);
  const hidden = changedTotal - changed.length;
  const markedEdited = changed.filter(
    (c) => c.edited && marked.has(c.key),
  ).length;
  const replaced = everything
    ? changedTotal - editedTotal + markedEdited
    : marked.size;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      {everything && <input type="hidden" name="substituirTodos" value="1" />}
      {changed.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4">
          <div>
            <h3 className="text-sm font-semibold text-warning-text">
              {changedTotal === 1
                ? "1 registro já existe no índice com dados diferentes"
                : `${changedTotal} registros já existem no índice com dados diferentes`}
            </h3>
            <p className="mt-1 text-xs text-warning-text">
              Deseja substituir? Marque os que devem receber os dados deste
              arquivo. Os não marcados ficam como estão. Campos em branco no
              arquivo nunca apagam o que o índice já tem.
            </p>
            {hidden > 0 && (
              <p className="mt-1 text-xs text-warning-text">
                Aparecem aqui os {changed.length} primeiros. Para receber os
                dados do arquivo em todos os {changedTotal}, marque "Substituir
                todos".
              </p>
            )}
          </div>
          {hidden > 0 && (
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <input
                type="checkbox"
                checked={everything}
                onChange={() => setEverything((v) => !v)}
                className="checkbox-admin"
              />
              Substituir todos os {changedTotal - editedTotal}
              {editedTotal > 0 && " que não foram corrigidos no painel"}
            </label>
          )}
          {editedTotal > 0 && (
            <p className="text-xs text-warning-text">
              {editedTotal === 1
                ? "1 registro foi corrigido à mão no painel e aparece primeiro na lista."
                : `${editedTotal} registros foram corrigidos à mão no painel e aparecem primeiro na lista.`}{" "}
              Eles só recebem os dados do arquivo se forem marcados um por um,
              para a correção não se perder.
            </p>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={all}
              onChange={() =>
                setMarked(all ? new Set() : new Set(changed.map((c) => c.key)))
              }
            />
            Marcar todos
          </label>
          <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
            {changed.map((item) => (
              <li key={item.key}>
                <label className="flex items-start gap-2 rounded-md bg-card px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="substituir"
                    value={item.key}
                    checked={marked.has(item.key)}
                    onChange={() => toggle(item.key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.edited && (
                      <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
                        Corrigido no painel
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {item.changes.join("; ")}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || newCount + replaced === 0}
        className="self-start"
      >
        {pending
          ? "Publicando..."
          : `Publicar no índice (${newCount} novo${newCount === 1 ? "" : "s"}${replaced > 0 ? `, ${replaced} substituído${replaced === 1 ? "" : "s"}` : ""})`}
      </Button>
    </form>
  );
}

export function DiscardForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CloseState, FormData>(
    discardImportAction,
    IDLE,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Descartando..." : "Descartar este arquivo"}
      </Button>
    </form>
  );
}
