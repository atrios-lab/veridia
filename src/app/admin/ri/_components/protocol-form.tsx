"use client";

import { useActionState, useState } from "react";
import { TITLE_KINDS } from "@/core/ri/protocol.ts";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import {
  issueRequirementsAction,
  type RiState,
  reentryAction,
  saveProtocolAction,
} from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export interface ProtocolFormValue {
  id: string;
  kind: "prenotacao" | "exame";
  presentedOn: string;
  presenterName: string;
  presenterDocument: string;
  presenterContact: string;
  titleKind: string;
  actsSummary: string;
  matriculas: string;
  fast: boolean;
  reurb: boolean;
  fees: string;
  feeValue: string;
  notes: string;
}

function Field({
  name,
  label,
  defaultValue,
  hint,
  required,
  placeholder,
  list,
  wide,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  list?: string;
  wide?: boolean;
}) {
  const id = `p-${name}`;
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        list={list}
        className="bg-background"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * The título at the counter: who presents it, what it is, which matrículas,
 * and the cases that change the prazos (art. 188, § 1º; Reurb social).
 */
export function ProtocolForm({
  value,
  feeReminder,
}: {
  value?: ProtocolFormValue;
  /** The fee table reminder, next to the emolumentos. */
  feeReminder?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveProtocolAction, IDLE);
  useRiToast(state);
  const [kind, setKind] = useState(value?.kind ?? "prenotacao");
  return (
    <form action={action} className="flex flex-col gap-5">
      {value && <input type="hidden" name="id" value={value.id} />}
      <fieldset className="rounded-xl border bg-card px-4 py-4 shadow-xs md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Lançamento
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              [
                "prenotacao",
                "Prenotação (Livro 1)",
                "Lei nº 6.015/1973, art. 182",
              ],
              [
                "exame",
                "Só exame e cálculo",
                "Lei nº 6.015/1973, art. 12, parágrafo único",
              ],
            ] as const
          ).map(([k, label, source]) => (
            <label
              key={k}
              className={`flex min-w-56 flex-1 cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm ${kind === k ? "border-primary bg-primary/5" : "bg-background"} ${value ? "pointer-events-none opacity-70" : ""}`}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  disabled={Boolean(value)}
                  className="size-4"
                />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">{source}</span>
            </label>
          ))}
          {value && <input type="hidden" name="kind" value={value.kind} />}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {kind === "exame"
            ? "O título só para exame e cálculo não é prenotado e não ganha prioridade; tem numeração própria."
            : "O número de ordem fixa a prioridade do título (arts. 182 e 186). A qualificação vence em 10 dias úteis e a prenotação em 20 (arts. 188 e 205, contados em dias úteis pelo art. 9º, § 1º)."}
        </p>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card px-4 py-4 shadow-xs sm:grid-cols-2 md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Apresentação
        </legend>
        <Field
          name="presentedOn"
          label="Data da apresentação"
          placeholder="dd/mm/aaaa (vazio: hoje)"
          defaultValue={value?.presentedOn}
        />
        <Field
          name="presenterName"
          label="Apresentante"
          required
          defaultValue={value?.presenterName}
        />
        <Field
          name="presenterDocument"
          label="CPF ou CNPJ do apresentante"
          defaultValue={value?.presenterDocument}
        />
        <Field
          name="presenterContact"
          label="Telefone ou e-mail"
          defaultValue={value?.presenterContact}
        />
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card px-4 py-4 shadow-xs sm:grid-cols-2 md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Título
        </legend>
        <Field
          name="titleKind"
          label="Natureza do título"
          required
          list="ri-title-kinds"
          defaultValue={value?.titleKind}
          hint="Títulos que entram no Registro de Imóveis: Lei nº 6.015/1973, art. 221."
        />
        <datalist id="ri-title-kinds">
          {TITLE_KINDS.map((t) => (
            <option key={t.name} value={t.name}>
              {t.source}
            </option>
          ))}
        </datalist>
        <Field
          name="matriculas"
          label="Matrícula(s)"
          placeholder="Ex.: 1.234; 1.235"
          defaultValue={value?.matriculas}
        />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="p-actsSummary">Atos pedidos</Label>
          <Textarea
            id="p-actsSummary"
            name="actsSummary"
            rows={2}
            defaultValue={value?.actsSummary ?? ""}
            placeholder="Ex.: registro da compra e venda; averbação da construção"
            className="field-sizing-fixed bg-background"
          />
        </div>
        {kind === "prenotacao" && (
          <div className="flex flex-col gap-2 text-sm sm:col-span-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="fast"
                defaultChecked={value?.fast}
                className="mt-0.5 size-4"
              />
              <span>
                Prazo de 5 dias úteis: escritura de compra e venda sem cláusulas
                especiais, averbação de construção, cancelamento de garantia ou
                documento eletrônico do SERP.
                <span className="block text-xs text-muted-foreground">
                  Lei nº 6.015/1973, art. 188, § 1º
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="reurb"
                defaultChecked={value?.reurb}
                className="mt-0.5 size-4"
              />
              <span>
                Regularização fundiária de interesse social: a prenotação dura
                40 dias úteis.
                <span className="block text-xs text-muted-foreground">
                  Lei nº 6.015/1973, art. 205, parágrafo único
                </span>
              </span>
            </label>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border bg-card px-4 py-4 shadow-xs sm:grid-cols-2 md:px-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Emolumentos e observações
        </legend>
        {feeReminder && <div className="sm:col-span-2">{feeReminder}</div>}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="p-fees">Códigos e valores da tabela</Label>
          <Textarea
            id="p-fees"
            name="fees"
            rows={2}
            defaultValue={value?.fees ?? ""}
            placeholder="Ex.: código da prenotação e do registro, como na tabela vigente"
            className="field-sizing-fixed bg-background"
          />
        </div>
        <Field
          name="feeValue"
          label="Total recebido (R$)"
          defaultValue={value?.feeValue}
        />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="p-notes">Observações internas</Label>
          <Textarea
            id="p-notes"
            name="notes"
            rows={2}
            defaultValue={value?.notes ?? ""}
            className="field-sizing-fixed bg-background"
          />
        </div>
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando…"
            : value
              ? "Salvar alterações"
              : kind === "exame"
                ? "Lançar para exame e cálculo"
                : "Prenotar o título"}
        </Button>
      </div>
    </form>
  );
}

/** The exigências, one per line: "texto | fonte". */
export function RequirementsForm({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  const [state, action, pending] = useActionState(
    issueRequirementsAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor={`req-${id}`}>
        Exigências, uma por linha: o que fazer | fonte jurídica
      </Label>
      <Textarea
        id={`req-${id}`}
        name="exigencias"
        rows={6}
        defaultValue={current}
        placeholder={
          "Apresente a guia do ITBI paga | Lei nº 6.015/1973, art. 289\nApresente a certidão de casamento atualizada | Lei nº 6.015/1973, art. 176, § 1º, III"
        }
        className="field-sizing-fixed bg-background"
      />
      <p className="text-xs text-muted-foreground">
        Todas de uma vez, claras e com a fonte (art. 198). Ao salvar, o
        protocolo fica em exigência e a nota sai em PDF.
      </p>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar a nota devolutiva"}
        </Button>
      </div>
    </form>
  );
}

export function ReentryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reentryAction, IDLE);
  useRiToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`reentry-${id}`}>Reingresso em</Label>
        <Input
          id={`reentry-${id}`}
          name="data"
          placeholder="dd/mm/aaaa"
          required
          className="bg-background"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Salvando…" : "Lançar o reingresso"}
      </Button>
    </form>
  );
}
