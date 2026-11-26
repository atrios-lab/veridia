"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import {
  applyOnrReadingAction,
  type OnrImageState,
  openLivro2Action,
  prepareOnrImageAction,
} from "../actions.ts";
import { ActionButton, useRiToast } from "./client.tsx";

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
        // In the order of the names: 001, 002, 003…
        .sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
        )
        .slice(0, 100)
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
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2">
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
            Várias de uma vez: na janela de escolher, segure Ctrl e clique em
            cada uma (ou Ctrl+A para todas da pasta), ou arraste os arquivos
            para cá. Até 100 por vez, 4 MB cada. Recomendado: o Word salvo como
            PDF (Arquivo › Salvar como › PDF).
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
                <div className="mt-1 flex flex-col gap-2">
                  <p className="text-xs font-medium text-success-text">
                    Pronta: matrícula nº{" "}
                    {it.state.number.toLocaleString("pt-BR")} na fila.
                    {it.state.issues.length > 0 &&
                      " (gerada com os apontamentos conferidos)"}
                  </p>
                  <FichaChanges
                    id={it.state.id}
                    read={it.state.read}
                    changes={it.state.changes}
                  />
                  {it.state.book && (
                    <OpenBook
                      suggestion={it.state.book}
                      onDone={() => router.refresh()}
                    />
                  )}
                </div>
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

const KIND_LABELS: Record<string, string> = {
  "nova-matricula": "Matrícula nova no acervo",
  "novo-registro": "Novo registro",
  "nova-averbacao": "Nova averbação",
  retificacao: "Retificação de ato já lançado",
};

/** What the ficha changes in the acervo, and the button to apply it. */
export function FichaChanges({
  id,
  read,
  changes,
  applied,
}: {
  id: string;
  read: boolean;
  changes: { kind: string; label: string; before?: string; after?: string }[];
  applied?: boolean;
}) {
  if (!read) {
    return (
      <p className="text-xs text-muted-foreground">
        O assistente virtual não leu esta ficha (desligado ou indisponível):
        lance os atos na matrícula pelo acervo.
      </p>
    );
  }
  if (changes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nada muda no acervo: a ficha confere com a matrícula lançada.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <p className="text-xs font-medium text-foreground">
        O que esta ficha muda no acervo:
      </p>
      <ul className="flex flex-col gap-1 text-xs text-foreground">
        {changes.map((c) => (
          <li key={`${c.kind}-${c.label}`}>
            <span className="font-medium">
              {KIND_LABELS[c.kind] ?? c.kind}:
            </span>{" "}
            {c.label}
            {c.kind === "retificacao" && c.before && (
              <span className="block text-muted-foreground">
                Antes: {c.before.slice(0, 200)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {applied ? (
        <p className="text-xs font-medium text-success-text">
          Já aplicado ao acervo.
        </p>
      ) : (
        <div>
          <ActionButton
            action={applyOnrReadingAction}
            fields={{ id }}
            label="Aplicar ao acervo"
            pendingLabel="Aplicando…"
            variant="default"
          />
        </div>
      )}
    </div>
  );
}

/**
 * No Livro 2 open yet: open it with the termo de abertura on the date of
 * the averbação de transporte, confirmed by the office.
 */
function OpenBook({
  suggestion,
  onDone,
}: {
  suggestion: {
    date: string | null;
    fromTransport: boolean;
    volume: string;
    firstItem: number;
  };
  onDone: () => void;
}) {
  const [date, setDate] = useState(suggestion.date ?? "");
  const [transport, setTransport] = useState(false);
  const [state, setState] = useState<
    { status: "idle" } | { status: "success" | "error"; message: string }
  >({ status: "idle" });
  const [pending, setPending] = useState(false);
  useRiToast(state);
  if (state.status === "success") {
    return (
      <p className="text-xs font-medium text-success-text">{state.message}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <p className="text-xs font-medium text-foreground">
        Não há Livro 2 aberto. Abrir o Livro {suggestion.volume} a partir da
        matrícula nº {suggestion.firstItem.toLocaleString("pt-BR")}, com o termo
        de abertura na data do transporte?
      </p>
      <p className="text-xs text-muted-foreground">
        {suggestion.fromTransport
          ? "A data veio da averbação de transporte lida na ficha."
          : "A ficha não trouxe averbação de transporte: confira a data."}{" "}
        O livro é aberto e encerrado pelo oficial (Lei nº 6.015/1973, art. 4º);
        o número se conserva com letras (art. 6º); as matrículas passam para
        fichas com a mesma numeração (art. 173, parágrafo único; CNN, art. 336).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={`open-date-${suggestion.firstItem}`}
            className="text-xs"
          >
            Data do termo de abertura
          </Label>
          <Input
            id={`open-date-${suggestion.firstItem}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 bg-background"
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-4"
            checked={transport}
            onChange={(e) => setTransport(e.target.checked)}
          />
          É esta mesma a data do 1º ato de transporte
        </label>
        <Button
          type="button"
          size="sm"
          disabled={pending || !date || !transport}
          onClick={async () => {
            setPending(true);
            const form = new FormData();
            form.set("data", date);
            form.set("transporte", transport ? "1" : "0");
            form.set("volume", suggestion.volume);
            form.set("firstItem", String(suggestion.firstItem));
            const result = await openLivro2Action(form);
            setPending(false);
            if (result.status !== "idle") setState(result);
            if (result.status === "success") onDone();
          }}
        >
          {pending ? "Abrindo…" : "Abrir o Livro 2"}
        </Button>
      </div>
    </div>
  );
}
