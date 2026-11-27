"use client";

import { useActionState } from "react";
import type { BookColumn } from "@/core/books/catalog.ts";
import { ConfirmAction } from "../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import {
  type BookState,
  importBooksAction,
  saveBookEntryAction,
  setBookEntryDeletedAction,
} from "./livros-actions.ts";

const IDLE: BookState = { status: "idle" };

function Message({ state }: { state: BookState }) {
  if (state.status === "idle") return null;
  return (
    <output
      className={`block text-sm ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {state.message}
    </output>
  );
}

/**
 * Import: choose the book, or let the system tell each file's book by its
 * columns; one or more files; and how (conferir, só novos, completar).
 */
export function BookImportForm({
  attribution,
  books,
  fixedBook,
}: {
  attribution: string;
  books: { key: string; name: string }[];
  fixedBook?: string;
}) {
  const [state, dispatch, pending] = useActionState(importBooksAction, IDLE);
  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <input type="hidden" name="atribuicao" value={attribution} />
      {fixedBook ? (
        <input type="hidden" name="livro" value={fixedBook} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`import-book-${attribution}`}>De qual livro?</Label>
          <NativeSelect
            id={`import-book-${attribution}`}
            name="livro"
            defaultValue="auto"
          >
            <option value="auto">
              Importar tudo: o sistema identifica o livro de cada arquivo
            </option>
            {books.map((b) => (
              <option key={b.key} value={b.key}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`import-mode-${attribution}-${fixedBook ?? "all"}`}>
          Como importar
        </Label>
        <NativeSelect
          id={`import-mode-${attribution}-${fixedBook ?? "all"}`}
          name="modo"
          defaultValue="conferir"
        >
          <option value="conferir">Só conferir (não grava nada)</option>
          <option value="novos">Acrescentar só os lançamentos novos</option>
          <option value="completar">
            Acrescentar os novos e completar campos vazios dos existentes
          </option>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`import-file-${attribution}-${fixedBook ?? "all"}`}>
          Arquivos (.xlsx, .csv, .ods ou .json; pode escolher vários)
        </Label>
        <input
          id={`import-file-${attribution}-${fixedBook ?? "all"}`}
          type="file"
          name="arquivo"
          multiple
          accept=".xlsx,.csv,.ods,.json"
          required
          className="block w-full rounded-md border bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Lendo..." : "Importar"}
        </Button>
      </div>
      <Message state={state} />
      <p className="text-xs text-muted-foreground">
        Nada é sobrescrito: um valor que já está no livro nunca é trocado pela
        importação. Comece por &quot;Só conferir&quot; para ver o resultado
        antes de gravar.
      </p>
    </form>
  );
}

/** Lança a line, or changes it (asks the reason). */
export function BookEntryForm({
  attribution,
  book,
  columns,
  id,
  value,
}: {
  attribution: string;
  book: string;
  columns: BookColumn[];
  id?: string;
  value?: Record<string, string>;
}) {
  const [state, dispatch, pending] = useActionState(saveBookEntryAction, IDLE);
  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <input type="hidden" name="atribuicao" value={attribution} />
      <input type="hidden" name="livro" value={book} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {columns.map((c) => {
          const fieldId = `${id ?? "new"}-${c.key}`;
          return (
            <div
              key={c.key}
              className={`flex flex-col gap-1.5 ${c.kind === "long" ? "sm:col-span-2" : ""}`}
            >
              <Label htmlFor={fieldId}>
                {c.label}
                {c.required ? " *" : ""}
              </Label>
              {c.kind === "long" ? (
                <Textarea
                  id={fieldId}
                  name={c.key}
                  rows={2}
                  defaultValue={value?.[c.key] ?? ""}
                  readOnly={Boolean(id) && c.key === "numero"}
                  className="bg-background"
                />
              ) : (
                <Input
                  id={fieldId}
                  name={c.key}
                  defaultValue={value?.[c.key] ?? ""}
                  readOnly={Boolean(id) && c.key === "numero"}
                  placeholder={c.kind === "date" ? "dd/mm/aaaa" : undefined}
                  className="bg-background"
                />
              )}
            </div>
          );
        })}
      </div>
      {id && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-justificativa`}>
            Por que está alterando? *
          </Label>
          <Input
            id={`${id}-justificativa`}
            name="justificativa"
            className="bg-background"
          />
        </div>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Salvando..."
            : id
              ? "Salvar alteração"
              : "Incluir no livro"}
        </Button>
      </div>
      <Message state={state} />
    </form>
  );
}

export function BookEntryDeleteButton({
  attribution,
  book,
  id,
  number,
  restore,
}: {
  attribution: string;
  book: string;
  id: string;
  number: number;
  restore?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(
    setBookEntryDeletedAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={dispatch}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger={restore ? "Restaurar" : "Apagar"}
      question={
        restore
          ? `Restaurar o nº ${number}?`
          : `Apagar o lançamento nº ${number}?`
      }
      consequence={
        restore
          ? "Ele volta ao livro."
          : "Sai do livro e das exportações, mas fica guardado. Quem não é o Tabelião envia o pedido para ele aprovar."
      }
      confirmLabel={restore ? "Restaurar" : "Apagar"}
      pendingLabel="Salvando..."
      {...(restore
        ? {
            triggerClassName: buttonVariants({
              size: "sm",
              variant: "outline",
            }),
          }
        : {})}
    >
      <input type="hidden" name="atribuicao" value={attribution} />
      <input type="hidden" name="livro" value={book} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={restore ? "restore" : "delete"} />
    </ConfirmAction>
  );
}
