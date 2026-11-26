"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { type OnrImageState, prepareOnrImageAction } from "../actions.ts";

type Item = {
  key: string;
  file: File;
  number: string;
  state: OnrImageState | { status: "waiting" } | { status: "running" };
  confirm: boolean;
};

/**
 * "Assinar para exportar para a ONR": the matrículas in PDF (recommended:
 * the page as the office left it in the Word) or in Word, one or many.
 * Each goes in its own request, in order; what the conferência points out
 * waits for "Conferi, gerar assim".
 */
export function OnrImageForm({
  patterns,
  hasSignature,
}: {
  patterns: { id: string; label: string }[];
  hasSignature: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pattern, setPattern] = useState(patterns[0]?.id ?? "p12");
  const [sign, setSign] = useState(hasSignature);
  const [running, setRunning] = useState(false);

  const choose = (list: FileList | null) => {
    setItems(
      Array.from(list ?? [])
        .slice(0, 50)
        .map((file, i) => ({
          key: `${i}-${file.name}`,
          file,
          number: "",
          state: { status: "waiting" },
          confirm: false,
        })),
    );
  };
  const update = (key: string, patch: Partial<Item>) =>
    setItems((all) =>
      all.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );

  const run = async (only?: string) => {
    setRunning(true);
    for (const item of items) {
      if (only ? item.key !== only : item.state.status === "saved") continue;
      update(item.key, { state: { status: "running" } });
      const form = new FormData();
      form.set("arquivo", item.file);
      form.set("numero", item.number);
      form.set("padrao", pattern);
      form.set("assinar", sign ? "1" : "0");
      form.set("conferi", item.confirm ? "1" : "0");
      const state = await prepareOnrImageAction(form).catch(
        (): OnrImageState => ({
          status: "error",
          message: "Não deu para gerar agora. Tente de novo.",
        }),
      );
      update(item.key, {
        state,
        number:
          state.status === "check" && state.number && !item.number
            ? String(state.number)
            : item.number,
      });
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onr-files">Matrículas em PDF ou Word</Label>
          <Input
            ref={input}
            id="onr-files"
            type="file"
            multiple
            accept=".pdf,.docx,application/pdf"
            onChange={(e) => choose(e.target.files)}
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Recomendado: o Word salvo como PDF (Arquivo › Salvar como › PDF). A
            imagem sai igual à página. Até 4 MB cada.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onr-pattern">Padrão de pasta e nome</Label>
          <NativeSelect
            id="onr-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          >
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={sign}
          disabled={!hasSignature}
          onChange={(e) => setSign(e.target.checked)}
        />
        <span>
          Pôr a imagem da minha assinatura logo abaixo do último ato
          {!hasSignature && (
            <span className="block text-xs text-muted-foreground">
              Cadastre a imagem em RI › Configurações para usar.
            </span>
          )}
        </span>
      </label>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.key}
              className="rounded-lg border bg-background px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm font-medium break-all">
                  {it.file.name}
                </span>
                <span className="flex items-center gap-2">
                  <Label htmlFor={`num-${it.key}`} className="text-xs">
                    Matrícula nº
                  </Label>
                  <Input
                    id={`num-${it.key}`}
                    value={it.number}
                    placeholder="do texto"
                    inputMode="numeric"
                    onChange={(e) => update(it.key, { number: e.target.value })}
                    className="h-8 w-28 bg-background"
                  />
                </span>
              </div>
              {it.state.status === "running" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Conferindo e gerando a imagem…
                </p>
              )}
              {it.state.status === "saved" && (
                <p className="mt-1 text-xs font-medium text-success-text">
                  Pronta: matrícula nº {it.state.number.toLocaleString("pt-BR")}{" "}
                  na fila.
                  {it.state.issues.length > 0 &&
                    " (gerada com os apontamentos conferidos)"}
                </p>
              )}
              {it.state.status === "error" && (
                <p
                  role="alert"
                  className="mt-1 text-xs font-medium text-destructive"
                >
                  {it.state.message}
                </p>
              )}
              {it.state.status === "check" && (
                <div className="mt-2 flex flex-col gap-2 rounded-md border border-warning/50 bg-warning-soft px-3 py-2">
                  <p className="text-xs font-medium text-foreground">
                    Confira antes de gerar:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-foreground">
                    {it.state.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={it.confirm}
                      onChange={(e) =>
                        update(it.key, { confirm: e.target.checked })
                      }
                    />
                    Conferi: está certo, pode gerar assim
                  </label>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={running}
                      onClick={() => run(it.key)}
                    >
                      Gerar de novo
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          type="button"
          disabled={running || items.length === 0}
          onClick={() => run()}
        >
          {running
            ? "Gerando…"
            : items.length > 1
              ? `Assinar e gerar ${items.length} imagens para a ONR`
              : "Assinar e gerar a imagem para a ONR"}
        </Button>
      </div>
    </div>
  );
}
