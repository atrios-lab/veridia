"use client";

import { useActionState, useId } from "react";
import {
  type CertidaoField,
  type CertidaoForm as CertidaoVia,
  certidaoModel,
} from "@/core/rcpn/certidao.ts";
import type { RcpnKind } from "@/core/rcpn/record.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { FilePicker } from "../../../_components/file-picker.tsx";
import { Button } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  attachCertidaoAction,
  type CertidaoState,
  issueCertidaoAction,
  removeCertidaoAction,
  updateCertidaoAction,
} from "./actions.ts";

const IDLE: CertidaoState = { status: "idle" };

export interface CertidaoFormValues {
  id?: string;
  recordId?: string;
  kind: RcpnKind;
  form: CertidaoVia;
  natimorto: boolean;
  fields: Record<string, string>;
  seal: string;
  sealKind: string;
  fees: string;
  signerName: string;
  signerTitle: string;
}

/** The model's rows: fields with the same `row`, side by side. */
function rowsOf(fields: CertidaoField[]): CertidaoField[][] {
  const rows: CertidaoField[][] = [];
  for (const field of fields) {
    const last = rows.at(-1);
    const head = last?.[0];
    if (last && head && field.row !== undefined && head.row === field.row) {
      last.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

function FieldInput({
  id,
  field,
  value,
  locked = false,
}: {
  id: string;
  field: CertidaoField;
  value: string;
  /** The registro's matrícula: shown, not changed. */
  locked?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5"
      style={{ flex: `${field.span ?? 1} 1 10rem` }}
    >
      <Label htmlFor={id}>
        {field.label}
        {field.required ? " *" : ""}
      </Label>
      {field.multiline ? (
        <Textarea
          id={id}
          name={`campo.${field.key}`}
          defaultValue={value}
          rows={field.key === "teor" ? 14 : 3}
          maxLength={field.key === "teor" ? 20000 : LONG_TEXT_MAX}
        />
      ) : locked ? (
        <>
          <input type="hidden" name={`campo.${field.key}`} value={value} />
          <Input
            id={id}
            value={value}
            readOnly
            aria-readonly="true"
            className="bg-muted font-mono text-muted-foreground"
          />
        </>
      ) : (
        <Input
          id={id}
          name={`campo.${field.key}`}
          defaultValue={value}
          maxLength={500}
          className={field.key === "matricula" ? "font-mono" : ""}
          autoComplete="off"
        />
      )}
      {field.key === "matricula" && (
        <p className="text-xs text-muted-foreground">
          {locked
            ? "A matrícula é a do registro e não se altera."
            : "32 dígitos, em nove blocos (6 2 2 4 1 5 3 7 2): serventia, acervo, serviço, ano, tipo de livro, livro, folha, termo e dígito verificador."}
        </p>
      )}
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

/**
 * The certidão in the national model, field by field, already filled with
 * what the index knows. Every field can be changed (a typing error is
 * corrected here, decision of 14/11/2026). The selo is pasted from the
 * office's TJRN lot while there is no caixa.
 */
export function CertidaoForm({
  initial,
  signers,
}: {
  initial: CertidaoFormValues;
  signers: { name: string; title: string }[];
}) {
  const editing = Boolean(initial.id);
  const [state, action, pending] = useActionState<CertidaoState, FormData>(
    editing ? updateCertidaoAction : issueCertidaoAction,
    IDLE,
  );
  const base = useId();
  const model = certidaoModel(initial.kind, initial.form);
  const known = signers.findIndex(
    (s) => s.name === initial.signerName && s.title === initial.signerTitle,
  );
  const firstSigner =
    signers.length === 0
      ? "outro"
      : known >= 0
        ? String(known)
        : initial.signerName
          ? "outro"
          : "0";

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="tipo" value={initial.kind} />
      <input type="hidden" name="via" value={initial.form} />
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {initial.recordId && (
        <input type="hidden" name="registro" value={initial.recordId} />
      )}

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">
          Texto da certidão
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Os campos seguem o modelo da {model.title.toLowerCase()}, nas mesmas
          linhas. O que o índice tem já vem preenchido; complete o resto com o
          livro. Pode corrigir qualquer campo.
        </p>
        {initial.kind === "obito" && (
          <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="natimorto"
              value="1"
              defaultChecked={initial.natimorto}
              className="checkbox-admin mt-0.5"
            />
            <span>
              Natimorto (registro no Livro C Auxiliar, Lei nº 6.015/1973, art.
              33, V, e art. 53, § 1º)
            </span>
          </label>
        )}
        <div className="mt-4 flex flex-col gap-4">
          {rowsOf(model.fields).map((row) => (
            <div
              key={row.map((f) => f.key).join("-")}
              className="flex flex-wrap gap-4"
            >
              {row.map((field) => (
                <FieldInput
                  key={field.key}
                  id={`${base}-campo-${field.key}`}
                  field={field}
                  value={initial.fields[field.key] ?? ""}
                  locked={
                    field.key === "matricula" &&
                    Boolean(initial.recordId) &&
                    Boolean(initial.fields.matricula?.trim())
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-semibold text-foreground">
          Selo, emolumentos e assinatura
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enquanto o Caixa não existe, copie o selo digital do lote da serventia
          (SIEX/TJRN) e cole aqui. Ele sai no pé da certidão com o endereço de
          conferência do TJRN.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${base}-selo`}>Selo digital de fiscalização</Label>
            <Input
              id={`${base}-selo`}
              name="selo"
              defaultValue={initial.seal}
              maxLength={120}
              className="font-mono"
              autoComplete="off"
              placeholder="Cole o código do selo"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${base}-selo-tipo`}>Tipo do selo</Label>
            <NativeSelect
              id={`${base}-selo-tipo`}
              name="seloTipo"
              defaultValue={initial.sealKind}
              className="w-full"
            >
              <NativeSelectOption value="">Não informar</NativeSelectOption>
              <NativeSelectOption value="Normal">Normal</NativeSelectOption>
              <NativeSelectOption value="Isento">Isento</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor={`${base}-emolumentos`}>
              Emolumentos e taxas (como a serventia imprime)
            </Label>
            <Textarea
              id={`${base}-emolumentos`}
              name="emolumentos"
              defaultValue={initial.fees}
              rows={2}
              maxLength={600}
              placeholder="Por exemplo: Emolumentos R$ 0,00; FDJ R$ 0,00; Total R$ 0,00. Na gratuidade, escreva a lei."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${base}-assinante`}>Quem assina</Label>
            <NativeSelect
              id={`${base}-assinante`}
              name="assinante"
              defaultValue={firstSigner}
              className="w-full"
            >
              {signers.map((s, i) => (
                <NativeSelectOption key={`${s.name}-${s.title}`} value={i}>
                  {s.name} ({s.title})
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="outro">
                Outra pessoa (escrever abaixo)
              </NativeSelectOption>
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              A lista é a dos assinantes das Guias imobiliárias.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${base}-nome`}>Nome (outra pessoa)</Label>
              <Input
                id={`${base}-nome`}
                name="assinanteNome"
                defaultValue={known >= 0 ? "" : initial.signerName}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${base}-cargo`}>Cargo (outra pessoa)</Label>
              <Input
                id={`${base}-cargo`}
                name="assinanteCargo"
                defaultValue={known >= 0 ? "" : initial.signerTitle}
                maxLength={200}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs">
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="conferida"
            value="1"
            required
            className="checkbox-admin mt-0.5"
          />
          <span>
            Conferi o texto desta certidão com o registro no livro. O índice
            orienta; quem dá fé é o livro.
          </span>
        </label>
        {editing && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${base}-justificativa`}>
              Justificativa da correção
            </Label>
            <Textarea
              id={`${base}-justificativa`}
              name="justificativa"
              rows={2}
              required
              maxLength={LONG_TEXT_MAX}
              placeholder="Por exemplo: erro de digitação no nome da mãe."
            />
            <p className="text-xs text-muted-foreground">
              Vai para a auditoria, com quem corrigiu e quando.
            </p>
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {state.message}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : editing
                ? "Salvar correção"
                : "Emitir certidão"}
          </Button>
        </div>
      </section>
    </form>
  );
}

/** The certidão signed by hand and scanned, or signed digitally. */
export function AttachForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CertidaoState, FormData>(
    attachCertidaoAction,
    IDLE,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <FilePicker
        name="anexo"
        accept="application/pdf,image/*"
        label="Certidão assinada"
        hint="PDF ou imagem: a assinada à mão e digitalizada, ou a assinada digitalmente."
        required
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && (
        <p className="text-sm font-semibold text-success-text">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Anexando..." : "Anexar"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveCertidaoButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CertidaoState, FormData>(
    removeCertidaoAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta certidão?"
      consequence="Ela sai da lista e continua guardada, com a justificativa, na auditoria."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
