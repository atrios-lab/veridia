"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  type CedulaAddendum,
  type CedulaData,
  type CedulaGuarantee,
  type CedulaPerson,
  CHANGE_KINDS,
  CHANGE_LABELS,
  HERE_OPTIONS,
  NEW_MONEY_LABELS,
  PERSON_ROLE_LABELS,
  PERSON_ROLES,
} from "@/core/cedulas/analise.ts";
import {
  GUARANTEE_KINDS,
  GUARANTEE_LABELS,
  KIND_OPTIONS,
} from "@/core/cedulas/especies.ts";
import { formatMoneyTyping, toMoneyText } from "@/core/money-input.ts";
import { formatTaxId } from "@/core/tax-id.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { cn } from "../../../_ui/cn.ts";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  type CedulaState,
  changeLearnedAction,
  createCedulaAnalysisAction,
  createCedulaNoteAction,
  linkCedulaRequestAction,
  removeCedulaAnalysisAction,
  restoreCedulaAnalysisAction,
  saveCedulaModelAction,
  saveChargeNotesAction,
  updateCedulaDataAction,
} from "./actions.ts";

const IDLE: CedulaState = { status: "idle" };

function useToast(state: CedulaState) {
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
  }, [state]);
}

function ErrorLine({ state }: { state: CedulaState }) {
  return state.status === "error" ? (
    <p role="alert" className="text-sm font-semibold text-destructive">
      {state.message}
    </p>
  ) : null;
}

// ------------------------------------------------------------- new

export function NewAnalysisForm({
  requestId,
  protocol,
  attachments,
}: {
  requestId?: string;
  protocol?: string;
  attachments: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    createCedulaAnalysisAction,
    IDLE,
  );
  const [files, setFiles] = useState<string[]>([]);
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      {requestId && <input type="hidden" name="pedido" value={requestId} />}
      {attachments.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-foreground">
            Arquivos do pedido {protocol}
          </legend>
          <p className="text-sm text-muted-foreground">
            Marque a cédula e os aditivos. Eles são lidos e continuam só no
            pedido.
          </p>
          {attachments.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="anexoPedido"
                value={a.id}
                defaultChecked
                className="checkbox-admin"
              />
              {a.name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="ced-arquivos">
          {attachments.length > 0
            ? "Outros arquivos (opcional)"
            : "Cédula e aditivos"}
        </Label>
        <label
          htmlFor="ced-arquivos"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary/60"
        >
          <span className={buttonVariants({ variant: "outline", size: "sm" })}>
            Escolher arquivos
          </span>
          <span>
            PDF, foto ou Word. Até 10 arquivos de 20 MB. Lidos e descartados:
            nada fica guardado além do nome.
          </span>
          <input
            id="ced-arquivos"
            type="file"
            name="arquivos"
            multiple
            accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) =>
              setFiles([...(event.target.files ?? [])].map((f) => f.name))
            }
          />
        </label>
        {files.length > 0 && (
          <ul className="text-sm text-foreground">
            {files.map((name) => (
              <li key={name}>• {name}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        O sistema lê os documentos sozinho: descobre a espécie, o livro e os
        atos e preenche os dados. Você só confere depois.
      </p>
      {/* Only without a file the clerk picks the kind (decision of
          21/11/2026: "é para ler sozinho e saber"). */}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          Não tem o arquivo? Preencher à mão
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Label htmlFor="ced-especie">Espécie da cédula</Label>
          <NativeSelect id="ced-especie" name="especie" defaultValue="">
            <NativeSelectOption value="">Escolha a espécie</NativeSelectOption>
            {KIND_OPTIONS.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Com arquivo anexado, deixe em branco: a espécie vem do documento.
          </p>
        </div>
      </details>
      <ErrorLine state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Lendo os documentos (pode levar até um minuto)..."
          : "Analisar"}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------- data

const field = "flex flex-col gap-1.5";
const small = "text-xs text-muted-foreground";

function TextField({
  label,
  value,
  onChange,
  long,
  placeholder,
  money,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  long?: boolean;
  placeholder?: string;
  /** A value in reais: the dots and the comma go in by themselves. */
  money?: boolean;
}) {
  const id = useId();
  return (
    <div className={field}>
      <Label htmlFor={id}>{label}</Label>
      {long ? (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={money ? toMoneyText(value) : value}
          placeholder={placeholder}
          inputMode={money ? "numeric" : undefined}
          onChange={(e) =>
            onChange(money ? formatMoneyTyping(e.target.value) : e.target.value)
          }
        />
      )}
    </div>
  );
}

const emptyPerson = (): CedulaPerson => ({
  role: "emitente",
  name: "",
  taxId: "",
  qualification: "",
});
const emptyGuarantee = (): CedulaGuarantee => ({
  kind: "hipoteca",
  grade: "1º",
  description: "",
  registration: "",
  location: "",
  municipality: "",
  here: "nao-sei",
  owner: "",
});
const emptyAddendum = (n: number): CedulaAddendum => ({
  title: `${n}º aditivo`,
  date: "",
  changes: [],
  previousDue: "",
  newDue: "",
  previousAmount: "",
  newAmount: "",
  guaranteeChange: "",
  description: "",
  newMoney: "nao-sei",
  newMoneyAmount: "",
});

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {title}
      </legend>
      {children}
      {action}
    </fieldset>
  );
}

export function CedulaDataForm({
  id,
  initial,
  disabled,
}: {
  id: string;
  initial: CedulaData;
  disabled?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [state, action, pending] = useActionState(updateCedulaDataAction, IDLE);
  useToast(state);
  const set = <K extends keyof CedulaData>(key: K, value: CedulaData[K]) =>
    setData((d) => ({ ...d, [key]: value }));
  const setItem = <K extends "people" | "guarantees" | "addenda">(
    key: K,
    index: number,
    patch: Partial<CedulaData[K][number]>,
  ) =>
    setData((d) => ({
      ...d,
      [key]: (d[key] as CedulaData[K][number][]).map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  const removeItem = (key: "people" | "guarantees" | "addenda", i: number) =>
    setData((d) => ({
      ...d,
      [key]: (d[key] as unknown[]).filter((_, j) => j !== i),
    }));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dados" value={JSON.stringify(data)} />
      <fieldset disabled={disabled || pending} className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className={field}>
            <Label htmlFor={`especie-${id}`}>Espécie</Label>
            <NativeSelect
              id={`especie-${id}`}
              value={data.kind}
              onChange={(e) =>
                set("kind", e.target.value as CedulaData["kind"])
              }
            >
              {KIND_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className={small}>
              Corrigir a espécie ensina o sistema (só as palavras do título).
            </span>
          </div>
          <TextField
            label="Título, como no documento"
            value={data.title}
            onChange={(v) => set("title", v)}
          />
          <TextField
            label="Número"
            value={data.number}
            onChange={(v) => set("number", v)}
          />
          <TextField
            label="Emissão (data)"
            value={data.issuedOn}
            onChange={(v) => set("issuedOn", v)}
          />
          <TextField
            label="Local da emissão"
            value={data.issuePlace}
            onChange={(v) => set("issuePlace", v)}
          />
          <TextField
            label="Valor do crédito (R$)"
            money
            value={data.amount}
            onChange={(v) => set("amount", v)}
            placeholder="0,00"
          />
          <TextField
            label="Vencimento"
            value={data.dueOn}
            onChange={(v) => set("dueOn", v)}
          />
          <TextField
            label="Praça de pagamento"
            value={data.paymentPlace}
            onChange={(v) => set("paymentPlace", v)}
          />
          <TextField
            label="Protocolo (número)"
            value={data.protocolNumber}
            onChange={(v) => set("protocolNumber", v)}
          />
          <TextField
            label="Protocolo (data)"
            value={data.protocolDate}
            onChange={(v) => set("protocolDate", v)}
          />
        </div>
        <TextField
          label="Forma de pagamento"
          value={data.paymentTerms}
          onChange={(v) => set("paymentTerms", v)}
          long
        />
        <TextField
          label="Juros e encargos"
          value={data.charges}
          onChange={(v) => set("charges", v)}
          long
        />
        {data.kind === "produto-rural" && (
          <TextField
            label="Produto, quantidade e características (CPR)"
            value={data.product}
            onChange={(v) => set("product", v)}
            long
          />
        )}
        {data.kind === "credito-imobiliario" && (
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Série da CCI"
              value={data.series}
              onChange={(v) => set("series", v)}
            />
            <TextField
              label="Instituição custodiante"
              value={data.custodian}
              onChange={(v) => set("custodian", v)}
            />
          </div>
        )}
        {data.kind === "credito-bancario" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox-admin"
              checked={data.ruralCredit}
              onChange={(e) => set("ruralCredit", e.target.checked)}
            />
            CCB usada em operação de crédito rural (emolumentos como os da
            cédula rural)
          </label>
        )}

        <Section
          title="Partes"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => set("people", [...data.people, emptyPerson()])}
            >
              Acrescentar parte
            </Button>
          }
        >
          {data.people.map((p, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: editable list
              key={i}
              className="grid gap-2 rounded-md bg-muted/50 p-3 md:grid-cols-4"
            >
              <NativeSelect
                aria-label="Papel"
                value={p.role}
                onChange={(e) =>
                  setItem("people", i, {
                    role: e.target.value as CedulaPerson["role"],
                  })
                }
              >
                {PERSON_ROLES.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {PERSON_ROLE_LABELS[r]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                aria-label="Nome"
                placeholder="Nome"
                value={p.name}
                onChange={(e) => setItem("people", i, { name: e.target.value })}
              />
              <Input
                aria-label="CPF ou CNPJ"
                placeholder="CPF ou CNPJ"
                inputMode="numeric"
                value={formatTaxId(p.taxId)}
                onChange={(e) =>
                  setItem("people", i, { taxId: formatTaxId(e.target.value) })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem("people", i)}
              >
                Tirar
              </Button>
              <Input
                aria-label="Qualificação"
                placeholder="Nacionalidade, estado civil, profissão, endereço"
                className="md:col-span-4"
                value={p.qualification}
                onChange={(e) =>
                  setItem("people", i, { qualification: e.target.value })
                }
              />
            </div>
          ))}
        </Section>

        <Section
          title="Garantias"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                set("guarantees", [...data.guarantees, emptyGuarantee()])
              }
            >
              Acrescentar garantia
            </Button>
          }
        >
          {data.guarantees.map((g, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: editable list
              key={i}
              className="grid gap-2 rounded-md bg-muted/50 p-3 md:grid-cols-3"
            >
              <NativeSelect
                aria-label="Tipo de garantia"
                value={g.kind}
                onChange={(e) =>
                  setItem("guarantees", i, {
                    kind: e.target.value as CedulaGuarantee["kind"],
                  })
                }
              >
                {GUARANTEE_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {GUARANTEE_LABELS[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                aria-label="Grau"
                placeholder="Grau (1º, 2º...)"
                value={g.grade}
                onChange={(e) =>
                  setItem("guarantees", i, { grade: e.target.value })
                }
              />
              <NativeSelect
                aria-label="Fica nesta circunscrição?"
                value={g.here}
                onChange={(e) =>
                  setItem("guarantees", i, {
                    here: e.target.value as CedulaGuarantee["here"],
                  })
                }
              >
                {HERE_OPTIONS.map((h) => (
                  <NativeSelectOption key={h} value={h}>
                    {h === "sim"
                      ? "Nesta circunscrição"
                      : h === "nao"
                        ? "Fora desta circunscrição"
                        : "Circunscrição: conferir"}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Textarea
                aria-label="Descrição dos bens"
                placeholder="Descrição dos bens ou do imóvel"
                className="md:col-span-3"
                rows={2}
                value={g.description}
                onChange={(e) =>
                  setItem("guarantees", i, { description: e.target.value })
                }
              />
              <Input
                aria-label="Matrícula"
                placeholder="Matrícula nº"
                value={g.registration}
                onChange={(e) =>
                  setItem("guarantees", i, { registration: e.target.value })
                }
              />
              <Input
                aria-label="Onde estão os bens"
                placeholder="Onde estão os bens (penhor)"
                value={g.location}
                onChange={(e) =>
                  setItem("guarantees", i, { location: e.target.value })
                }
              />
              <Input
                aria-label="Município"
                placeholder="Município/UF"
                value={g.municipality}
                onChange={(e) =>
                  setItem("guarantees", i, { municipality: e.target.value })
                }
              />
              <Input
                aria-label="Proprietário"
                placeholder="Proprietário (se for terceiro)"
                className="md:col-span-2"
                value={g.owner}
                onChange={(e) =>
                  setItem("guarantees", i, { owner: e.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem("guarantees", i)}
              >
                Tirar
              </Button>
            </div>
          ))}
        </Section>

        <Section
          title="Aditivos e aditamentos"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                set("addenda", [
                  ...data.addenda,
                  emptyAddendum(data.addenda.length + 1),
                ])
              }
            >
              Acrescentar aditivo
            </Button>
          }
        >
          {data.addenda.length === 0 && (
            <p className={small}>
              Nenhum aditivo. Acrescente um para saber se é averbação ou
              registro e como cobrar.
            </p>
          )}
          {data.addenda.map((a, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: editable list
              key={i}
              className="flex flex-col gap-3 rounded-md bg-muted/50 p-3"
            >
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  aria-label="Nome do aditivo"
                  value={a.title}
                  onChange={(e) =>
                    setItem("addenda", i, { title: e.target.value })
                  }
                />
                <Input
                  aria-label="Data do aditivo"
                  placeholder="Data"
                  value={a.date}
                  onChange={(e) =>
                    setItem("addenda", i, { date: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem("addenda", i)}
                >
                  Tirar aditivo
                </Button>
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-foreground">
                  O que mudou?
                </legend>
                <div className="grid gap-1 md:grid-cols-2">
                  {CHANGE_KINDS.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox-admin"
                        checked={a.changes.includes(c)}
                        onChange={(e) =>
                          setItem("addenda", i, {
                            changes: e.target.checked
                              ? [...a.changes, c]
                              : a.changes.filter((x) => x !== c),
                          })
                        }
                      />
                      {CHANGE_LABELS[c]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-2 md:grid-cols-4">
                <Input
                  aria-label="Vencimento antes"
                  placeholder="Vencimento antes"
                  value={a.previousDue}
                  onChange={(e) =>
                    setItem("addenda", i, { previousDue: e.target.value })
                  }
                />
                <Input
                  aria-label="Vencimento depois"
                  placeholder="Vencimento depois"
                  value={a.newDue}
                  onChange={(e) =>
                    setItem("addenda", i, { newDue: e.target.value })
                  }
                />
                <Input
                  aria-label="Valor antes"
                  placeholder="Valor antes"
                  inputMode="numeric"
                  value={toMoneyText(a.previousAmount)}
                  onChange={(e) =>
                    setItem("addenda", i, {
                      previousAmount: formatMoneyTyping(e.target.value),
                    })
                  }
                />
                <Input
                  aria-label="Valor depois"
                  placeholder="Valor depois"
                  inputMode="numeric"
                  value={toMoneyText(a.newAmount)}
                  onChange={(e) =>
                    setItem("addenda", i, {
                      newAmount: formatMoneyTyping(e.target.value),
                    })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NativeSelect
                  aria-label="Houve liberação de dinheiro novo?"
                  value={a.newMoney}
                  onChange={(e) =>
                    setItem("addenda", i, {
                      newMoney: e.target.value as CedulaAddendum["newMoney"],
                    })
                  }
                >
                  {(
                    Object.keys(
                      NEW_MONEY_LABELS,
                    ) as CedulaAddendum["newMoney"][]
                  ).map((k) => (
                    <NativeSelectOption key={k} value={k}>
                      {k === "nao-sei"
                        ? "Dinheiro novo: o aditivo não diz"
                        : `Dinheiro novo: ${NEW_MONEY_LABELS[k]}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  aria-label="Valor do dinheiro novo (crédito suplementar)"
                  placeholder="Valor do dinheiro novo, se houve"
                  inputMode="numeric"
                  value={toMoneyText(a.newMoneyAmount)}
                  onChange={(e) =>
                    setItem("addenda", i, {
                      newMoneyAmount: formatMoneyTyping(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Só dinheiro novo (crédito suplementar) é cobrado pelo valor. Se
                o novo valor é o saldo antigo com juros, é averbação sem
                conteúdo econômico (Lei nº 10.169/2000, art. 2º, § 2º, II, b e
                c).
              </p>
              <Textarea
                aria-label="Bens incluídos, substituídos ou liberados"
                placeholder="Bens incluídos, substituídos ou liberados"
                rows={2}
                value={a.guaranteeChange}
                onChange={(e) =>
                  setItem("addenda", i, { guaranteeChange: e.target.value })
                }
              />
              <Textarea
                aria-label="Outras alterações"
                placeholder="Outras alterações, nas palavras do aditivo"
                rows={2}
                value={a.description}
                onChange={(e) =>
                  setItem("addenda", i, { description: e.target.value })
                }
              />
            </div>
          ))}
        </Section>

        <TextField
          label="Observações da serventia"
          value={data.notes}
          onChange={(v) => set("notes", v)}
          long
        />
      </fieldset>
      <ErrorLine state={state} />
      {!disabled && (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Salvando..." : "Salvar dados e refazer os atos"}
        </Button>
      )}
    </form>
  );
}

// ------------------------------------------------------------- models

export interface ModelItem {
  id: string;
  title: string;
  group: string;
  text: string;
  generated: string;
  edited: boolean;
}

const GROUP_LABEL: Record<string, string> = {
  registro: "Registro",
  averbacao: "Averbação",
  remissao: "Remissão",
  certidao: "Certidão",
  posterior: "Ato posterior",
};

export function ModelsPanel({
  id,
  models,
  disabled,
}: {
  id: string;
  models: ModelItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const current = models.find((m) => m.id === open) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {models.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setOpen(open === m.id ? null : m.id)}
            aria-pressed={open === m.id}
            className={cn(
              buttonVariants({
                variant: open === m.id ? "default" : "outline",
                size: "sm",
              }),
              "h-auto max-w-full whitespace-normal py-1.5 text-left",
            )}
          >
            <span className="font-semibold">{GROUP_LABEL[m.group] ?? ""}:</span>{" "}
            {m.title}
            {m.edited ? " (editado)" : ""}
          </button>
        ))}
      </div>
      {current ? (
        <ModelEditor
          key={`${current.id}-${current.text.length}`}
          id={id}
          model={current}
          disabled={disabled}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Clique num botão para abrir o modelo: editar, copiar, imprimir ou
          baixar em Word.
        </p>
      )}
    </div>
  );
}

function ModelEditor({
  id,
  model,
  disabled,
}: {
  id: string;
  model: ModelItem;
  disabled?: boolean;
}) {
  const [text, setText] = useState(model.text);
  const [state, action, pending] = useActionState(saveCedulaModelAction, IDLE);
  useToast(state);
  const changed = text !== model.text;
  const base = `/admin/utilitarios/cedulas/${id}/modelo?modelo=${model.id}`;
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="modelo" value={model.id} />
      <Label htmlFor={`modelo-${model.id}`}>{model.title}</Label>
      <Textarea
        id={`modelo-${model.id}`}
        name="texto"
        rows={16}
        value={text}
        readOnly={disabled}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Onde está [preencher: ...] falta um dado: complete aqui ou nos dados da
        cédula. A minuta é conferida e lavrada no sistema da serventia.
      </p>
      <ErrorLine state={state} />
      <div className="flex flex-wrap gap-2">
        {!disabled && (
          <Button type="submit" size="sm" disabled={pending || !changed}>
            {pending ? "Salvando..." : "Salvar texto"}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(text)
              .then(() => toast.success("Texto copiado."))
              .catch(() => toast.error("Não foi possível copiar."))
          }
        >
          Copiar
        </Button>
        <a
          href={base}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Imprimir (PDF)
        </a>
        <a
          href={`${base}&formato=word`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Baixar em Word
        </a>
        {model.edited && !disabled && (
          <Button
            type="submit"
            name="voltar"
            value="1"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Voltar ao texto gerado
          </Button>
        )}
      </div>
      {changed && (
        <p className="text-xs text-muted-foreground">
          Salve o texto antes de imprimir ou baixar em Word.
        </p>
      )}
    </form>
  );
}

// ------------------------------------------------- remove, restore, link

export function RemoveAnalysis({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    removeCedulaAnalysisAction,
    IDLE,
  );
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Apagar análise"
      question="Apagar esta análise?"
      consequence="Ela sai da lista e vai para Apagadas, com o motivo. Nada sai do banco: dá para restaurar."
      confirmLabel="Apagar"
      pendingLabel="Apagando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RestoreAnalysis({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    restoreCedulaAnalysisAction,
    IDLE,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <ErrorLine state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Restaurando..." : "Restaurar análise"}
      </Button>
    </form>
  );
}

export function LinkRequestForm({
  id,
  protocol,
  requestHref,
}: {
  id: string;
  protocol: string | null;
  requestHref: string | null;
}) {
  const [state, action, pending] = useActionState(
    linkCedulaRequestAction,
    IDLE,
  );
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      {protocol ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            Ligada ao pedido{" "}
            {requestHref ? (
              <Link href={requestHref} className="font-semibold underline">
                {protocol}
              </Link>
            ) : (
              <strong>{protocol}</strong>
            )}
            .
          </span>
          <Button
            type="submit"
            name="desligar"
            value="1"
            size="sm"
            variant="ghost"
            disabled={pending}
          >
            Desfazer vínculo
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className={field}>
            <Label htmlFor={`protocolo-${id}`}>Protocolo do pedido</Label>
            <Input
              id={`protocolo-${id}`}
              name="protocolo"
              placeholder="REQ.2026.000000"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Ligar ao pedido
          </Button>
        </div>
      )}
      <ErrorLine state={state} />
    </form>
  );
}

// ------------------------------------------------- learning and charging

export function LearnedRow({
  item,
}: {
  item: {
    id: string;
    cue: string;
    kind: string;
    uses: number;
    removed: boolean;
  };
}) {
  const [state, action, pending] = useActionState(changeLearnedAction, IDLE);
  useToast(state);
  return (
    <form
      action={action}
      className={cn(
        "flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between",
        item.removed && "opacity-60",
      )}
    >
      <input type="hidden" name="id" value={item.id} />
      <span className="flex flex-col">
        <span className="font-medium text-foreground">"{item.cue}"</span>
        <span className="text-xs text-muted-foreground">
          {item.uses} {item.uses === 1 ? "correção" : "correções"}
          {item.removed ? " · apagado" : ""}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <NativeSelect
          name="especie"
          defaultValue={item.kind}
          aria-label={`Espécie de "${item.cue}"`}
          disabled={item.removed}
        >
          {KIND_OPTIONS.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {!item.removed && (
          <Button
            type="submit"
            name="operacao"
            value="alterar"
            size="sm"
            variant="outline"
            disabled={pending}
          >
            Alterar
          </Button>
        )}
        <Button
          type="submit"
          name="operacao"
          value={item.removed ? "restaurar" : "apagar"}
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          {item.removed ? "Restaurar" : "Apagar"}
        </Button>
      </span>
      <ErrorLine state={state} />
    </form>
  );
}

export function ChargeNotesForm({
  bases,
  notes,
}: {
  bases: { key: string; label: string; law: string }[];
  notes: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(saveChargeNotesAction, IDLE);
  useToast(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      {bases.map((b) => (
        <div key={b.key} className={field}>
          <Label htmlFor={`nota-${b.key}`}>{b.label}</Label>
          <span className={small}>{b.law}</span>
          <Textarea
            id={`nota-${b.key}`}
            name={`nota:${b.key}`}
            rows={2}
            maxLength={2000}
            defaultValue={notes[b.key] ?? ""}
            placeholder="Ex.: item da tabela de emolumentos do Estado e como se calcula."
          />
        </div>
      ))}
      <ErrorLine state={state} />
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar notas de cobrança"}
      </Button>
    </form>
  );
}

// ------------------------------------------------- nota de exigência

export interface RequirementDraft {
  key: string;
  title: string;
  description: string;
  howToComply: string;
  basis: string;
  reference: string;
}

/**
 * The exigências the analysis found, for the clerk to check (decision of
 * 21/11/2026): each one marked, editable and removable, more can be
 * added, and the note opens in the Qualificação de títulos.
 */
export function RequirementsPanel({
  id,
  suggestions,
  presenter,
  canQualify,
  disabled,
}: {
  id: string;
  suggestions: RequirementDraft[];
  presenter: string;
  canQualify: boolean;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(
    suggestions.map((s) => ({ ...s, kept: true })),
  );
  const [who, setWho] = useState(presenter);
  const [state, action, pending] = useActionState(createCedulaNoteAction, IDLE);
  const kept = items.filter((i) => i.kept);
  const set = (index: number, patch: Partial<(typeof items)[number]>) =>
    setItems((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const presenterId = `apresentante-${id}`;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="exigencias"
        value={JSON.stringify(
          kept.map(({ title, description, howToComply, basis, reference }) => ({
            title,
            description,
            howToComply,
            basis,
            reference,
          })),
        )}
      />
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A análise não encontrou nada faltando. Se você viu alguma falha no
          título, acrescente a exigência abaixo.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          O que a análise encontrou faltando. Desmarque o que não se aplica,
          ajuste o texto e acrescente o que mais tiver visto.
        </p>
      )}
      <fieldset disabled={disabled || pending} className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div
            key={item.key}
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-border p-3",
              !item.kept && "opacity-60",
            )}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="checkbox-admin"
                checked={item.kept}
                onChange={(e) => set(i, { kept: e.target.checked })}
              />
              Incluir na nota
            </label>
            <Input
              aria-label="Título da exigência"
              value={item.title}
              onChange={(e) => set(i, { title: e.target.value })}
              placeholder="Título da exigência"
            />
            <Textarea
              aria-label="O que falta ou está errado"
              rows={2}
              value={item.description}
              onChange={(e) => set(i, { description: e.target.value })}
              placeholder="O que falta ou está errado"
            />
            <Textarea
              aria-label="Como cumprir"
              rows={2}
              value={item.howToComply}
              onChange={(e) => set(i, { howToComply: e.target.value })}
              placeholder="Como cumprir"
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                aria-label="Fundamento"
                value={item.basis}
                onChange={(e) => set(i, { basis: e.target.value })}
                placeholder="Fundamento (lei e artigo)"
              />
              <Input
                aria-label="A que se refere"
                value={item.reference}
                onChange={(e) => set(i, { reference: e.target.value })}
                placeholder="A que se refere (título, bem, pessoa)"
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            setItems((list) => [
              ...list,
              {
                key: `nova-${list.length + 1}`,
                title: "",
                description: "",
                howToComply: "",
                basis: "",
                reference: "",
                kept: true,
              },
            ])
          }
        >
          Acrescentar exigência
        </Button>
        <div className={field}>
          <Label htmlFor={presenterId}>Quem apresentou o título</Label>
          <Input
            id={presenterId}
            name="apresentante"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          />
        </div>
      </fieldset>
      <ErrorLine state={state} />
      {canQualify ? (
        <Button
          type="submit"
          disabled={disabled || pending || kept.length === 0}
          className="self-start"
        >
          {pending
            ? "Abrindo a nota..."
            : `Criar a nota de exigência (${kept.length})`}
        </Button>
      ) : (
        <p className="text-sm text-warning-text">
          A nota de exigência é emitida pela Qualificação de títulos. Peça ao
          Tabelião essa permissão em Perfis e permissões.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        A nota abre na Qualificação de títulos (Registro de Imóveis), com as
        exigências de uma só vez e fundamentadas. Lá ela é numerada, assinada,
        impressa ou baixada em Word e entregue; também dá para editar,
        acrescentar da biblioteca e fazer o reexame.
      </p>
    </form>
  );
}
