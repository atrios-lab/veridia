"use client";

import { useActionState } from "react";
import { Button } from "../../_ui/button.tsx";
import { Input } from "../../_ui/input.tsx";
import { Label } from "../../_ui/label.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Textarea } from "../../_ui/textarea.tsx";
import {
  addForeignAverbacaoAction,
  type RiState,
  recordForeignReportAction,
  saveForeignAction,
} from "../actions.ts";
import { useRiToast } from "./client.tsx";

const IDLE: RiState = { status: "idle" };

export type ForeignFormValue = Record<string, unknown>;

function Field({
  name,
  label,
  value,
  hint,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const id = `foreign-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={id}
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="bg-background"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Lança or changes an assento (Decreto nº 74.965/1974, art. 15). */
export function ForeignForm({
  value,
  id,
}: {
  value?: ForeignFormValue;
  id?: string;
}) {
  const [state, dispatch, pending] = useActionState(saveForeignAction, IDLE);
  useRiToast(state);
  const v = (key: string) => String(value?.[key] ?? "");
  return (
    <form action={dispatch} className="flex flex-col gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foreign-kind">Ato</Label>
          <NativeSelect
            id="foreign-kind"
            name="kind"
            defaultValue={v("kind") || "aquisicao"}
          >
            <option value="aquisicao">Aquisição</option>
            <option value="arrendamento">Arrendamento</option>
          </NativeSelect>
        </div>
        <Field
          name="registeredOn"
          label="Data do registro na matrícula"
          value={v("registeredOn")}
          placeholder="dd/mm/aaaa"
          required
        />
        <Field name="matricula" label="Matrícula nº" value={v("matricula")} />
        <Field
          name="actRef"
          label="Ato na matrícula"
          value={v("actRef")}
          placeholder="R-3"
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Adquirente ou arrendatário
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foreign-acquirerKind">Quem adquire</Label>
          <NativeSelect
            id="foreign-acquirerKind"
            name="acquirerKind"
            defaultValue={v("acquirerKind") || "pf-estrangeira"}
          >
            <option value="pf-estrangeira">
              Pessoa física estrangeira residente no Brasil
            </option>
            <option value="pj-estrangeira">
              Pessoa jurídica estrangeira autorizada a funcionar no Brasil
            </option>
            <option value="pj-equiparada">
              Pessoa jurídica brasileira com maioria do capital estrangeiro
            </option>
          </NativeSelect>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="acquirerName"
            label="Nome ou razão social"
            value={v("acquirerName")}
            required
          />
          <Field
            name="nationality"
            label="Nacionalidade"
            value={v("nationality")}
            hint="Obrigatória para pessoa física."
          />
          <Field
            name="acquirerDocument"
            label="Documento"
            value={v("acquirerDocument")}
            hint="Passaporte ou RNM; da pessoa jurídica, os atos constitutivos."
            required
          />
          <div />
          <Field
            name="spouseName"
            label="Cônjuge ou companheiro(a) brasileiro(a)"
            value={v("spouseName")}
          />
          <Field
            name="spouseCpf"
            label="CPF do cônjuge"
            value={v("spouseCpf")}
          />
          <Field
            name="transmitterName"
            label="Transmitente ou arrendador"
            value={v("transmitterName")}
          />
          <Field
            name="transmitterDocument"
            label="CPF ou CNPJ do transmitente"
            value={v("transmitterDocument")}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Imóvel rural</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="area" label="Área (ha)" value={v("area")} required />
          <Field
            name="municipality"
            label="Município"
            value={v("municipality")}
            required
          />
          <Field name="ccir" label="CCIR" value={v("ccir")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foreign-description">
            Descrição (características, limites e confrontações) *
          </Label>
          <Textarea
            id="foreign-description"
            name="description"
            defaultValue={v("description")}
            rows={3}
            className="bg-background"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="securityArea"
            defaultChecked={value?.securityArea === true}
          />
          Área indispensável à segurança nacional (faixa de fronteira)
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Certidões e autorizações
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            name="authorityBody"
            label="Órgão"
            value={v("authorityBody")}
            placeholder="INCRA"
          />
          <Field
            name="authorizationNumber"
            label="Número da autorização"
            value={v("authorizationNumber")}
          />
          <Field
            name="authorizationDate"
            label="Data"
            value={v("authorizationDate")}
            placeholder="dd/mm/aaaa"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foreign-notes">Observações</Label>
          <Textarea
            id="foreign-notes"
            name="notes"
            defaultValue={v("notes")}
            rows={2}
            className="bg-background"
          />
        </div>
      </fieldset>

      {id && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="foreign-justificativa">
            Por que está alterando? *
          </Label>
          <Input
            id="foreign-justificativa"
            name="justificativa"
            className="bg-background"
          />
        </div>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : id ? "Salvar alteração" : "Lançar assento"}
        </Button>
      </div>
    </form>
  );
}

export function ForeignAverbacaoForm({ id }: { id: string }) {
  const [state, dispatch, pending] = useActionState(
    addForeignAverbacaoAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={dispatch} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
        <Label htmlFor={`averbacao-${id}`}>Nova averbação</Label>
        <Input
          id={`averbacao-${id}`}
          name="texto"
          placeholder="Ex.: cancelamento do arrendamento"
          className="bg-background"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Lançando..." : "Averbar"}
      </Button>
    </form>
  );
}

/** Records the relação (or certidão negativa) of a trimestre as sent. */
export function ForeignReportForm({
  year,
  quarter,
  recipients,
  negative,
}: {
  year: number;
  quarter: number;
  recipients: string[];
  negative: boolean;
}) {
  const [state, dispatch, pending] = useActionState(
    recordForeignReportAction,
    IDLE,
  );
  useRiToast(state);
  return (
    <form action={dispatch} className="flex flex-col gap-3">
      <input type="hidden" name="ano" value={year} />
      <input type="hidden" name="trimestre" value={quarter} />
      <input
        type="hidden"
        name="kind"
        value={negative ? "negativa" : "positiva"}
      />
      <div className="flex flex-col gap-1">
        {recipients.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="recipients" value={r} defaultChecked />
            {r}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sent-${year}-${quarter}`}>Enviada em</Label>
          <Input
            id={`sent-${year}-${quarter}`}
            name="sentOn"
            placeholder="dd/mm/aaaa (vazio: hoje)"
            className="w-44 bg-background"
          />
        </div>
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor={`notes-${year}-${quarter}`}>
            Como enviou (protocolo, e-mail, Malote Digital)
          </Label>
          <Input
            id={`notes-${year}-${quarter}`}
            name="notes"
            className="bg-background"
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Registrando..." : "Registrar o envio"}
        </Button>
      </div>
    </form>
  );
}
