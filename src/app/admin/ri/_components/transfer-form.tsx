"use client";

import { upload } from "@vercel/blob/client";
import { startTransition, useActionState, useRef, useState } from "react";
import { FilePicker } from "../../_components/file-picker.tsx";
import { Button } from "../../_ui/button.tsx";
import { type TransferState, transferImportAction } from "../actions.ts";

const IDLE: TransferState = { status: "idle" };

/**
 * Imports into the Registro de Imóveis, in two steps on the same form:
 * "Conferir" reads the file and shows what would come in; "Importar"
 * saves only what is missing. With the store configured the file goes
 * straight to it (a deploy caps a request near 4.5 MB) and both steps
 * read it from there.
 */
export function TransferForm({
  direct,
  folder,
}: {
  direct: boolean;
  folder: string;
}) {
  const [state, action, pending] = useActionState(transferImportAction, IDLE);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const sent = useRef<{ key: string; url: string; name: string } | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Not `action={...}`: React clears the form after an action, and the
    // second step needs the file still chosen.
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    const file = data.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      setNote("Escolha o arquivo.");
      return;
    }
    setNote("");
    if (!direct) {
      startTransition(() => action(data));
      return;
    }
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    setSending(true);
    (async () => {
      try {
        if (sent.current?.key !== key) {
          const blob = await upload(
            `${folder}importacao/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "_")}`,
            file,
            {
              access: "public",
              contentType: file.type || "application/octet-stream",
              handleUploadUrl: "/api/ri/upload",
              multipart: file.size > 20 * 1024 * 1024,
            },
          );
          sent.current = { key, url: blob.url, name: file.name };
        }
        data.delete("arquivo");
        data.set("url", sent.current?.url ?? "");
        data.set("nome", sent.current?.name ?? file.name);
        startTransition(() => action(data));
      } catch {
        setNote("Não foi possível enviar o arquivo agora. Tente de novo.");
      } finally {
        setSending(false);
      }
    })();
  };

  const busy = pending || sending;
  const message = note || (state.status === "error" ? state.message : "");
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FilePicker
        name="arquivo"
        accept=".xlsx,.csv,.txt,.json,.xml,text/csv,application/json,text/xml,application/xml"
        label="Arquivo para importar"
        hint="Planilha (.xlsx ou .csv), JSON exportado aqui, JSON do Indicador Real da ONR, XML do Indicador Pessoal (Banco Light) ou XML do lote de CNM. Até 40 MB."
        required
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="completar"
          value="1"
          className="mt-0.5 size-4"
        />
        <span>
          Nas matrículas que já estão no sistema, completar só os campos vazios
          com o que veio no arquivo (nenhum valor já cadastrado muda; cada
          alteração fica no histórico da matrícula).
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="intent"
          value="preview"
          variant="outline"
          disabled={busy}
        >
          {busy ? "Lendo…" : "Conferir o arquivo"}
        </Button>
        {state.status === "preview" && (
          <Button type="submit" name="intent" value="import" disabled={busy}>
            {busy ? "Importando…" : "Importar o que é novo"}
          </Button>
        )}
      </div>

      {message && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {message}
        </p>
      )}

      {state.status === "done" && (
        <div
          aria-live="polite"
          className="rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success-text"
        >
          <p className="font-semibold">Importação concluída.</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{state.properties} matrícula(s) nova(s)</li>
            {state.completed > 0 && (
              <li>
                {state.completed} matrícula(s) com campos vazios completados
              </li>
            )}
            <li>{state.acts} ato(s) lançado(s)</li>
            {state.people > 0 && (
              <li>
                {state.people} pessoa(s) da lista nova(s) no Indicador Pessoal
              </li>
            )}
            <li>
              Os proprietários e as partes dos atos entram no cadastro de
              pessoas junto com a matrícula e o ato.
            </li>
          </ul>
          {state.skipped.length > 0 && (
            <>
              <p className="mt-2 font-medium">
                Ficaram de fora ({state.skipped.length}):
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {state.skipped.slice(0, 50).map((s) => (
                  <li key={`${s.line}-${s.reason}`}>
                    Linha {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {state.status === "preview" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-semibold">{state.fileName}</span>, lido como{" "}
            <span className="font-semibold">{state.format}</span>. Confira e
            depois clique em Importar.
          </p>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            <li className="rounded-lg border bg-background px-3 py-2">
              <span className="block font-semibold">Matrículas</span>
              {state.properties.new} nova(s) · {state.properties.existing} já
              cadastrada(s)
              {state.properties.fillable > 0
                ? ` (${state.properties.fillable} com campos vazios a completar)`
                : ""}
            </li>
            <li className="rounded-lg border bg-background px-3 py-2">
              <span className="block font-semibold">Atos</span>
              {state.acts.new} novo(s) · {state.acts.existing} já lançado(s)
              {state.acts.orphan > 0
                ? ` · ${state.acts.orphan} sem matrícula`
                : ""}
            </li>
            <li className="rounded-lg border bg-background px-3 py-2">
              <span className="block font-semibold">Pessoas</span>
              {state.people.new} nova(s) · {state.people.existing} já
              cadastrada(s)
            </li>
          </ul>
          {state.columns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {state.columns.map((c, i) => (
                <span
                  key={`${c.header}-${i}`}
                  className={`rounded-full border px-2 py-0.5 ${c.field ? "bg-background" : "bg-warning-soft text-warning-text"}`}
                >
                  {c.header} → {c.field || "ignorada"}
                </span>
              ))}
            </div>
          )}
          {state.errors.length > 0 && (
            <ul className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-text">
              {state.errors.slice(0, 20).map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Linha {e.line}: {e.message} (fica de fora)
                </li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-xl text-left text-xs">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Linha</th>
                  <th className="px-2 py-1.5 font-medium">O que é</th>
                  <th className="px-2 py-1.5 font-medium">Conteúdo</th>
                  <th className="px-2 py-1.5 font-medium">Avisos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.sample.map((row, i) => (
                  <tr key={`${row.line}-${i}`}>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {row.line}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{row.what}</td>
                    <td className="px-2 py-1.5">{row.text}</td>
                    <td className="px-2 py-1.5 text-warning-text">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </form>
  );
}
