"use client";

import { useActionState, useId } from "react";
import { LONG_TEXT_MAX, MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import {
  CHANNELS,
  type Channel,
  OPERATIONS,
  SERVICES,
} from "@/core/titularidade/titularidade.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  createFilingAction,
  markSentAction,
  readTitleAction,
  refreshFilingAction,
  removeFilingAction,
  removeTransferAction,
  renumberFilingAction,
  saveTransferAction,
  type TitularidadeState,
} from "./actions.ts";

const IDLE: TitularidadeState = { status: "idle" };

const OPERATION_OPTIONS = Object.entries(OPERATIONS).sort(([a], [b]) =>
  a === "39" ? 1 : b === "39" ? -1 : 0,
);

function Box({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {hint && (
        <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
          {hint}
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Text({
  name,
  label,
  value,
  wide,
  hint,
  type = "text",
  base,
}: {
  name: string;
  label: string;
  value: string;
  wide?: boolean;
  hint?: string;
  type?: "text" | "date";
  base: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
    >
      <Label htmlFor={`${base}-${name}`}>{label}</Label>
      <Input
        id={`${base}-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={300}
        autoComplete="off"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Long({
  name,
  label,
  value,
  hint,
  rows = 3,
  base,
}: {
  name: string;
  label: string;
  value: string;
  hint?: string;
  rows?: number;
  base: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor={`${base}-${name}`}>{label}</Label>
      <Textarea
        id={`${base}-${name}`}
        name={name}
        defaultValue={value}
        rows={rows}
        maxLength={LONG_TEXT_MAX}
      />
      {hint && (
        <p className="text-xs text-muted-foreground text-justify hyphens-auto">
          {hint}
        </p>
      )}
    </div>
  );
}

function Choice({
  name,
  label,
  value,
  options,
  base,
  wide,
}: {
  name: string;
  label: string;
  value: string;
  options: [string, string][];
  base: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
    >
      <Label htmlFor={`${base}-${name}`}>{label}</Label>
      <NativeSelect
        id={`${base}-${name}`}
        name={name}
        defaultValue={value}
        className="w-full"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function Fields({
  values,
  base,
}: {
  values: Record<string, string>;
  base: string;
}) {
  const v = (key: string) => values[key] ?? "";
  return (
    <>
      <Box
        title="Ato"
        hint="Escritura do Tabelionato de Notas, ou registro ou averbação do Registro de Imóveis."
      >
        <Choice
          name="service"
          label="Serviço"
          value={v("service") || "notas"}
          options={Object.entries(SERVICES).map(([k, s]) => [k, s.label])}
          base={base}
        />
        <Choice
          name="act"
          label="Ato"
          value={v("act") || "escritura"}
          options={[
            ["escritura", "Escritura (Notas)"],
            ["procuracao", "Procuração em causa própria (Notas)"],
            ["registro", "Registro (Imóveis)"],
            ["averbacao", "Averbação (Imóveis)"],
          ]}
          base={base}
        />
        <Text
          name="actDate"
          label="Data do ato"
          type="date"
          value={v("actDate")}
          base={base}
        />
        <Text name="book" label="Livro (Notas)" value={v("book")} base={base} />
        <Text
          name="page"
          label="Folhas (Notas)"
          value={v("page")}
          base={base}
        />
        <Text
          name="entry"
          label="Registro ou averbação (Imóveis)"
          value={v("entry")}
          hint="Ex.: R-3 ou AV-5."
          base={base}
        />
      </Box>
      <Box
        title="Operação"
        hint="O ato ou fato que transmitiu o imóvel é obrigatório (Código Nacional de Normas, art. 184-A, § 3º). A lista é a mesma da DOI da Receita Federal."
      >
        <Choice
          name="operation"
          label="Operação"
          value={v("operation")}
          options={[["", "Escolha"], ...OPERATION_OPTIONS]}
          base={base}
          wide
        />
        <Text
          name="operationOther"
          label="Qual operação (se Outras)"
          value={v("operationOther")}
          wide
          base={base}
        />
      </Box>
      <Box
        title="Imóvel"
        hint="A prefeitura acha o cadastro pela inscrição imobiliária; sem ela, pelo endereço."
      >
        <Choice
          name="destination"
          label="Destinação"
          value={v("destination")}
          options={[
            ["", "Não informada"],
            ["urbano", "Urbano"],
            ["rural", "Rural"],
          ]}
          base={base}
        />
        <Text
          name="fiscalRegistration"
          label="Inscrição imobiliária"
          value={v("fiscalRegistration")}
          base={base}
        />
        <Text
          name="matricula"
          label="Matrícula"
          value={v("matricula")}
          base={base}
        />
        <Text
          name="registry"
          label="Registro de Imóveis da matrícula"
          value={v("registry")}
          base={base}
        />
        <Text
          name="address"
          label="Endereço"
          value={v("address")}
          wide
          base={base}
        />
        <Long
          name="description"
          label="Descrição"
          value={v("description")}
          rows={2}
          base={base}
        />
      </Box>
      <Box title="Valores">
        <Text
          name="value"
          label="Valor declarado (R$)"
          value={v("value")}
          hint="Em branco se o título não diz."
          base={base}
        />
        <Text
          name="taxBase"
          label="Base de cálculo do ITBI/ITCMD (R$)"
          value={v("taxBase")}
          base={base}
        />
      </Box>
      <Box
        title="Partes"
        hint="Uma pessoa por linha: nome; CPF ou CNPJ; participação. Exemplo: Maria Fictícia; 529.982.247-25; 50%"
      >
        <Long
          name="transmitentes"
          label="Transmitentes (quem vende, doa, cede)"
          value={v("transmitentes")}
          base={base}
        />
        <Long
          name="adquirentes"
          label="Adquirentes (quem compra, recebe)"
          value={v("adquirentes")}
          base={base}
        />
      </Box>
      <Box title="Observações">
        <Long
          name="notes"
          label="Observações"
          value={v("notes")}
          rows={2}
          base={base}
        />
      </Box>
    </>
  );
}

/**
 * Send the escritura or the registro, read it, check every field and save
 * (decision of 14/11/2026). Correcting a saved act asks why.
 */
export function TransferForm({
  id,
  values,
}: {
  id?: string;
  values: Record<string, string>;
}) {
  const [readState, read, reading] = useActionState(readTitleAction, IDLE);
  const [saveState, save, saving] = useActionState(saveTransferAction, IDLE);
  const base = useId();
  const shown = readState.status === "read" ? readState.values : values;
  return (
    <form className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      <input
        type="hidden"
        name="sourceName"
        value={readState.status === "read" ? readState.sourceName : ""}
      />
      {!id && (
        <section className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Ler a escritura ou o registro
          </h2>
          <p className="text-sm text-muted-foreground text-justify hyphens-auto">
            Envie o PDF pesquisável ou o Word (.docx) do traslado da escritura
            ou da certidão do registro. O sistema lê e preenche os campos
            abaixo; confira cada um antes de salvar. Nada fica guardado do
            arquivo, só o que você salvar.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor={`${base}-arquivo`}>Arquivo</Label>
              <Input
                id={`${base}-arquivo`}
                name="arquivo"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              formAction={read}
              formNoValidate
              disabled={reading}
            >
              {reading ? "Lendo..." : "Ler documento"}
            </Button>
          </div>
          {readState.status === "read" && (
            <output className="block rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-text">
              {readState.message}
            </output>
          )}
          {readState.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {readState.message}
            </p>
          )}
        </section>
      )}
      <div
        key={readState.status === "read" ? readState.stamp : "typed"}
        className="flex flex-col gap-5"
      >
        <Fields values={shown} base={base} />
      </div>
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
        {id && (
          <>
            <Label htmlFor={`${base}-justificativa`}>Justificativa</Label>
            <Textarea
              id={`${base}-justificativa`}
              name="justificativa"
              minLength={MIN_JUSTIFICATION}
              maxLength={LONG_TEXT_MAX}
              rows={2}
              placeholder="Por exemplo: corrigida a inscrição imobiliária conforme o carnê do IPTU."
            />
          </>
        )}
        {saveState.status === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {saveState.message}
          </p>
        )}
        <div>
          <Button type="submit" formAction={save} disabled={saving}>
            {saving
              ? "Salvando..."
              : id
                ? "Salvar alterações"
                : "Salvar na comunicação do mês"}
          </Button>
        </div>
      </section>
    </form>
  );
}

export function RemoveTransferButton({ id, mes }: { id: string; mes: string }) {
  const [state, action, pending] = useActionState(removeTransferAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir este ato da comunicação?"
      consequence="Ele sai da relação do mês, mas fica guardado, com quem excluiu, quando e por quê."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mes" value={mes} />
    </ConfirmAction>
  );
}

export function CreateFilingButton({
  mes,
  count,
}: {
  mes: string;
  count: number;
}) {
  const [state, action, pending] = useActionState(createFilingAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="mes" value={mes} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Gerando..."
            : count === 0
              ? "Mês negativo (sem atos)"
              : "Gerar ofício do mês"}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function MarkSentForm({
  id,
  sentOn,
  channel,
  receipt,
  semutOn,
  semutReceipt,
  hasReceiptFile,
  today,
}: {
  id: string;
  sentOn: string;
  /** The platform already registered, or the one the acts call for. */
  channel: Channel;
  receipt: string;
  semutOn: string;
  semutReceipt: string;
  hasReceiptFile: boolean;
  today: string;
}) {
  const [state, action, pending] = useActionState(markSentAction, IDLE);
  const base = useId();
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-sentOn`}>Enviado em</Label>
        <Input
          id={`${base}-sentOn`}
          name="sentOn"
          type="date"
          defaultValue={sentOn || today}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-channel`}>Plataforma</Label>
        <NativeSelect
          id={`${base}-channel`}
          name="channel"
          defaultValue={channel}
          className="w-full"
        >
          {Object.entries(CHANNELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-receipt`}>Número do recibo de entrega</Label>
        <Input
          id={`${base}-receipt`}
          name="receipt"
          defaultValue={receipt}
          maxLength={300}
          required
          minLength={3}
          placeholder="Como a plataforma informa"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-recibo`}>
          Comprovante{" "}
          {hasReceiptFile
            ? "(já anexado; envie outro para trocar)"
            : "(PDF ou imagem)"}
        </Label>
        <Input
          id={`${base}-recibo`}
          name="recibo"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
        />
      </div>
      <p className="text-xs text-muted-foreground text-justify hyphens-auto sm:col-span-2">
        As informações devem ser remetidas por meio eletrônico e mediante recibo
        de entrega: o Tabelionato de Notas à plataforma do CNB/CF, o Registro de
        Imóveis à do ONR (Código Nacional de Normas, art. 184-A, § 2º). O recibo
        é a prova do envio.
      </p>
      <fieldset className="grid gap-4 rounded-lg border px-4 py-3 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">
          Entrega do ofício à SEMUT (opcional)
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${base}-semutOn`}>Entregue em</Label>
          <Input
            id={`${base}-semutOn`}
            name="semutOn"
            type="date"
            defaultValue={semutOn}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${base}-semutReceipt`}>
            Protocolo na prefeitura
          </Label>
          <Input
            id={`${base}-semutReceipt`}
            name="semutReceipt"
            defaultValue={semutReceipt}
            maxLength={300}
          />
        </div>
      </fieldset>
      {state.status === "error" && (
        <p
          role="alert"
          className="text-sm font-medium text-destructive sm:col-span-2"
        >
          {state.message}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Registrar envio e recibo"}
        </Button>
      </div>
    </form>
  );
}

export function RemoveFilingButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeFilingAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir ofício"
      question="Excluir este ofício?"
      consequence="Ele fica guardado com o número, com quem excluiu, quando e por quê. Gere outro se precisar refazer a comunicação do mês."
      confirmLabel="Excluir ofício"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RefreshFilingButton({
  id,
  issuedOn,
}: {
  id: string;
  issuedOn: string;
}) {
  const [state, action, pending] = useActionState(refreshFilingAction, IDLE);
  const base = useId();
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Editar ofício"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Refazer o ofício com os atos do mês como estão agora?"
      consequence="O número continua o mesmo. Os atos corrigidos, incluídos ou excluídos depois entram no ofício."
      confirmLabel="Salvar"
      pendingLabel="Salvando..."
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-issuedOn`}>Data do ofício</Label>
        <Input
          id={`${base}-issuedOn`}
          name="issuedOn"
          type="date"
          defaultValue={issuedOn}
          required
        />
      </div>
    </ConfirmAction>
  );
}

export function RenumberFilingButton({
  id,
  sequence,
}: {
  id: string;
  sequence: number;
}) {
  const [state, action, pending] = useActionState(renumberFilingAction, IDLE);
  const base = useId();
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Modificar numeração"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Qual número este ofício deve ter?"
      consequence="Só aceita um número do ano que nenhum outro ofício use. A mudança vai para a auditoria."
      confirmLabel="Mudar número"
      pendingLabel="Mudando..."
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-sequence`}>Novo número</Label>
        <Input
          id={`${base}-sequence`}
          name="sequence"
          inputMode="numeric"
          defaultValue={String(sequence)}
          required
        />
      </div>
    </ConfirmAction>
  );
}
