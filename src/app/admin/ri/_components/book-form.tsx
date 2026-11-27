"use client";

import { useActionState, useState } from "react";
import { SignOrPrint } from "../../_components/sign-or-print.tsx";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import { closeBookAction, type RiState, saveBookAction } from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export interface BookFormValue {
  id: string;
  book: number;
  volume: string;
  form: string;
  sheetCount: string;
  firstItem: string;
  lastItem: string;
  openedOn: string;
  openingNotes: string;
}

function Field({
  id,
  name,
  label,
  defaultValue,
  hint,
  placeholder,
  required,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        className="bg-background"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Opens a book (or changes its data): which one, its number with the
 * letter (art. 6º), how it is kept, how many folhas or fichas, and from
 * which matrícula or número de ordem.
 */
export function BookForm({
  value,
  suggestions,
}: {
  value?: BookFormValue;
  /** The next free number of each book: "2-B" for the Livro 2. */
  suggestions: Record<number, string>;
}) {
  const [state, action, pending] = useActionState(saveBookAction, IDLE);
  useRiToast(state);
  const [book, setBook] = useState(value?.book ?? 2);
  const [volume, setVolume] = useState(value?.volume ?? suggestions[2] ?? "2");
  const prefix = value ? "bk-edit" : "bk-new";
  const itemLabel =
    book === 1
      ? "número de ordem"
      : book === 3
        ? "registro"
        : book === 2
          ? "matrícula"
          : "";
  return (
    <form action={action} className="flex flex-col gap-4">
      {value && <input type="hidden" name="id" value={value.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-book`}>Livro</Label>
          {value ? (
            <>
              <input type="hidden" name="book" value={value.book} />
              <Input
                id={`${prefix}-book`}
                value={`Livro nº ${value.book}`}
                readOnly
                className="bg-muted"
              />
            </>
          ) : (
            <NativeSelect
              id={`${prefix}-book`}
              name="book"
              value={String(book)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setBook(next);
                setVolume(suggestions[next] ?? String(next));
              }}
            >
              <option value="1">Livro nº 1 · Protocolo</option>
              <option value="2">Livro nº 2 · Registro Geral</option>
              <option value="3">Livro nº 3 · Registro Auxiliar</option>
              <option value="4">Livro nº 4 · Indicador Real</option>
              <option value="5">Livro nº 5 · Indicador Pessoal</option>
            </NativeSelect>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-volume`}>Número do livro</Label>
          <Input
            id={`${prefix}-volume`}
            name="volume"
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
            required
            className="bg-background"
          />
          <p className="text-xs text-muted-foreground">
            O número se conserva e ganha letras: {book}, {book}-A, {book}-B (Lei
            nº 6.015/1973, art. 6º).
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-form`}>Forma de escrituração</Label>
          <NativeSelect
            id={`${prefix}-form`}
            name="form"
            defaultValue={value?.form ?? (book === 1 ? "folhas" : "fichas")}
          >
            <option value="fichas">
              Fichas soltas (art. 173, parágrafo único)
            </option>
            <option value="folhas">Folhas (art. 3º, § 2º)</option>
            <option value="eletronico">
              Meio eletrônico (arts. 1º, § 3º, e 7º-A)
            </option>
            <option value="hibrido">
              Híbrido: meio eletrônico e impresso em folhas (arts. 1º, § 3º, e
              3º, § 2º)
            </option>
          </NativeSelect>
        </div>
        <Field
          id={`${prefix}-sheets`}
          name="sheetCount"
          label="Número de folhas ou fichas"
          inputMode="numeric"
          defaultValue={value?.sheetCount}
          hint="Vazio ou 0 quando o livro não tem número fixo (fichas ou meio eletrônico)."
        />
        {itemLabel && (
          <>
            <Field
              id={`${prefix}-first`}
              name="firstItem"
              label={`Primeiro(a) ${itemLabel}`}
              inputMode="numeric"
              defaultValue={value?.firstItem}
            />
            <Field
              id={`${prefix}-last`}
              name="lastItem"
              label={`Último(a) ${itemLabel}`}
              inputMode="numeric"
              defaultValue={value?.lastItem}
              hint="Vazio enquanto o livro está em uso."
            />
          </>
        )}
        <Field
          id={`${prefix}-opened`}
          name="openedOn"
          label="Data de abertura"
          placeholder="dd/mm/aaaa (vazio: hoje)"
          defaultValue={value?.openedOn}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${prefix}-notes`}>
          Observação no termo de abertura
        </Label>
        <Textarea
          id={`${prefix}-notes`}
          name="openingNotes"
          rows={2}
          defaultValue={value?.openingNotes ?? ""}
          placeholder="Ex.: autorização do juiz para o processo de autenticação, quando houver (art. 4º)"
          className="field-sizing-fixed bg-background"
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? "Salvando…"
            : value
              ? "Salvar alterações"
              : "Abrir o livro"}
        </Button>
      </div>
    </form>
  );
}

/** Closes the book: the date, the last folha and the last item written. */
export function CloseBookForm({
  id,
  book,
  lastItem,
}: {
  id: string;
  book: number;
  lastItem: string;
}) {
  const [state, action, pending] = useActionState(closeBookAction, IDLE);
  useRiToast(state);
  const item =
    book === 1
      ? "Último número de ordem"
      : book === 3
        ? "Último registro"
        : book === 2
          ? "Última matrícula"
          : "";
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          id={`close-on-${id}`}
          name="closedOn"
          label="Data do encerramento"
          placeholder="dd/mm/aaaa (vazio: hoje)"
        />
        <Field
          id={`close-sheet-${id}`}
          name="lastSheet"
          label="Última folha ou ficha escriturada"
          inputMode="numeric"
        />
        {item && (
          <Field
            id={`close-item-${id}`}
            name="lastItem"
            label={item}
            inputMode="numeric"
            defaultValue={lastItem}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`close-notes-${id}`}>
          Observação no termo de encerramento
        </Label>
        <Textarea
          id={`close-notes-${id}`}
          name="notes"
          rows={2}
          className="field-sizing-fixed bg-background"
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Encerrando…" : "Encerrar o livro"}
        </Button>
      </div>
    </form>
  );
}

/** The Protocolo of a day, closed (art. 184), to sign or print. */
export function ProtocolDay({ today }: { today: string }) {
  const [day, setDay] = useState(today);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day);
  const href = `/admin/ri/livros/protocolo-do-dia?data=${day}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 sm:max-w-56">
        <Label htmlFor="protocol-day">Dia</Label>
        <Input
          id="protocol-day"
          type="date"
          value={day}
          max={today}
          onChange={(event) => setDay(event.target.value)}
          className="bg-background"
        />
      </div>
      {valid && (
        <SignOrPrint
          pdfHref={href}
          title={`Protocolo do dia ${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`}
          size="sm"
        />
      )}
    </div>
  );
}
