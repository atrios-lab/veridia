"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import {
  OFFICIAL_CATALOG,
  SOURCE_AREAS,
  SOURCE_KINDS,
  type SourceMeta,
} from "@/core/conhecimento/base.ts";
import { MIN_JUSTIFICATION } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import { Input } from "../../../_ui/input.tsx";
import { Label } from "../../../_ui/label.tsx";
import { NativeSelect } from "../../../_ui/native-select.tsx";
import { Textarea } from "../../../_ui/textarea.tsx";
import {
  checkAction,
  confirmAction,
  dismissRequestAction,
  editMetaAction,
  importOfficialAction,
  type KnowledgeState,
  removeAction,
  replaceAction,
  restoreAction,
  type SendState,
  sendAction,
} from "./actions.ts";

const IDLE: KnowledgeState = { status: "idle" };
const BASE = "/admin/utilitarios/base-juridica";
const ACCEPT =
  ".pdf,.docx,.odt,.rtf,.txt,.md,.htm,.html,.xml,.zip,.jpg,.jpeg,.png,.gif,.webp";

function ErrorLine({ state }: { state: { status: string; message?: string } }) {
  return state.status === "error" ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {state.message}
    </p>
  ) : null;
}

/** Title, kind, reference, issuer, date, situation, address, areas, notes. */
function MetaFields({
  meta,
  single = true,
}: {
  meta?: SourceMeta;
  /** Several files: the reference and the address name one norma only. */
  single?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-tipo`}>Tipo da fonte</Label>
        <NativeSelect
          id={`${id}-tipo`}
          name="tipo"
          defaultValue={meta?.kind ?? "lei"}
        >
          {Object.entries(SOURCE_KINDS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-titulo`}>Título</Label>
        <Input
          id={`${id}-titulo`}
          name="titulo"
          maxLength={300}
          defaultValue={meta?.title ?? ""}
          placeholder={
            single
              ? "Ex.: Lei dos Registros Públicos"
              : "Vazio: cada arquivo usa o próprio nome"
          }
        />
      </div>
      {single && (
        <>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-ref`}>Referência</Label>
            <Input
              id={`${id}-ref`}
              name="referencia"
              maxLength={200}
              defaultValue={meta?.reference ?? ""}
              placeholder="Ex.: Lei nº 6.015/1973, Provimento CNJ nº 149/2023"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-end`}>Endereço oficial (opcional)</Label>
            <Input
              id={`${id}-end`}
              name="endereco"
              type="url"
              maxLength={1000}
              defaultValue={meta?.url ?? ""}
              placeholder="https://www.planalto.gov.br/..."
            />
          </div>
        </>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${id}-orgao`}>Órgão</Label>
        <Input
          id={`${id}-orgao`}
          name="orgao"
          maxLength={200}
          defaultValue={meta?.issuer ?? ""}
          placeholder="Ex.: CNJ, Corregedoria Geral de Justiça do RN, STJ"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-data`}>Data</Label>
          <Input
            id={`${id}-data`}
            name="data"
            type="date"
            defaultValue={meta?.date ?? ""}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-sit`}>Situação</Label>
          <NativeSelect
            id={`${id}-sit`}
            name="situacao"
            defaultValue={meta?.status ?? "vigente"}
          >
            <option value="vigente">Vigente</option>
            <option value="revogada">Revogada (não é usada)</option>
          </NativeSelect>
        </div>
      </div>
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className="text-sm font-medium text-foreground">
          Atribuições (nenhuma marcada: vale para todas)
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-2">
          {Object.entries(SOURCE_AREAS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="areas"
                value={value}
                defaultChecked={meta?.areas.includes(value as never) ?? false}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-notas`}>Observações</Label>
        <Textarea
          id={`${id}-notas`}
          name="notas"
          rows={2}
          maxLength={5000}
          defaultValue={meta?.notes ?? ""}
        />
      </div>
    </div>
  );
}

function Justification() {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>Justificativa (vai para a auditoria)</Label>
      <Input
        id={id}
        name="justificativa"
        required
        minLength={MIN_JUSTIFICATION}
      />
    </div>
  );
}

/** Files, a ZIP or pasted text, read, made Markdown and dropped. */
export function SendForm() {
  const [state, action, pending] = useActionState(sendAction, {
    status: "idle",
  } as SendState);
  const id = useId();
  return (
    <div className="flex flex-col gap-5">
      <form
        action={action}
        className="flex flex-col gap-5 rounded-xl border border-primary/25 bg-primary/5 p-6"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-docs`}>Arquivos da fonte</Label>
          <Input
            id={`${id}-docs`}
            name="documentos"
            type="file"
            multiple
            accept={ACCEPT}
          />
          <p className="text-xs text-muted-foreground text-justify hyphens-auto">
            PDF, Word (.docx), ODT, RTF, texto, página salva (HTML), ZIP com
            qualquer deles, e fotos (JPG, PNG). Cada arquivo vira uma fonte em
            Markdown e é descartado. Até 50 MB por arquivo e 100 MB por envio.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={`${id}-texto`}>Ou cole o texto</Label>
          <Textarea
            id={`${id}-texto`}
            name="texto"
            rows={5}
            placeholder="Cole aqui o texto da lei, do provimento, do acórdão ou do modelo."
          />
        </div>
        <MetaFields />
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Lendo e guardando..." : "Ler e guardar na base"}
          </Button>
        </div>
        <ErrorLine state={state} />
      </form>
      {state.status === "done" && (
        <section
          aria-live="polite"
          className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs"
        >
          <h2 className="text-lg font-semibold text-foreground">
            Relatório do envio
          </h2>
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["Arquivos enviados", state.report.files],
              ["Documentos lidos", state.report.read],
              ["Fontes guardadas", state.report.saved.length],
              [
                "Em conferência",
                state.report.saved.filter((s) => s.pending.length).length,
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border px-4 py-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {state.report.saved.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border text-sm">
              {state.report.saved.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      href={`${BASE}/${s.id}`}
                      className="font-medium text-foreground underline"
                    >
                      {s.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {s.pending.length
                        ? "Em conferência: não é usada até confirmar"
                        : "Em uso na base"}
                      {s.viaAi ? " · lida pelo Assistente Virtual" : ""}
                    </span>
                  </div>
                  {s.pending.map((p) => (
                    <p key={p} className="text-xs text-warning-text">
                      {p}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {state.report.notes.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              {state.report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** The text in force read straight from the official site. */
export function OfficialImportForm({
  imported,
  request,
}: {
  /** The catalog's addresses already in the base. */
  imported: string[];
  /** The AI's request this import answers, when it does. */
  request?: { id: string; url: string };
}) {
  const [state, action, pending] = useActionState(importOfficialAction, IDLE);
  const [manual, manualAction, manualPending] = useActionState(
    importOfficialAction,
    IDLE,
  );
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={`${id}-cat`}>Norma básica</Label>
          <NativeSelect id={`${id}-cat`} name="catalogo">
            {OFFICIAL_CATALOG.map((c) => (
              <option key={c.key} value={c.key}>
                {c.reference} · {c.title}
                {imported.includes(c.url) ? " (já na base: atualiza)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Lendo o site oficial..." : "Importar o texto vigente"}
        </Button>
        <div className="basis-full">
          <ErrorLine state={state} />
        </div>
      </form>
      <details open={Boolean(request)} className="rounded-lg border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Outra norma, pelo endereço oficial
        </summary>
        <form action={manualAction} className="mt-4 flex flex-col gap-4">
          {request && <input type="hidden" name="pedido" value={request.id} />}
          <MetaFields
            meta={
              request
                ? {
                    kind: "lei",
                    title: "",
                    reference: "",
                    issuer: "",
                    date: "",
                    status: "vigente",
                    url: request.url,
                    areas: [],
                    notes: "",
                  }
                : undefined
            }
          />
          <div>
            <Button type="submit" disabled={manualPending}>
              {manualPending ? "Lendo o site oficial..." : "Importar"}
            </Button>
          </div>
          <ErrorLine state={manual} />
        </form>
      </details>
    </div>
  );
}

export function EditMetaForm({ id, meta }: { id: string; meta: SourceMeta }) {
  const [state, action, pending] = useActionState(editMetaAction, IDLE);
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-xs"
    >
      <h2 className="text-lg font-semibold text-foreground">Dados da fonte</h2>
      <input type="hidden" name="id" value={id} />
      <MetaFields meta={meta} />
      <Justification />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar os dados"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/**
 * The wrong file swapped for the right one, or the text corrected: a new
 * version; the old one is kept, out of the base.
 */
export function ReplaceForm({
  id,
  markdown,
  request,
}: {
  id: string;
  markdown: string;
  /** The AI's request this new version answers. */
  request?: string;
}) {
  const [state, action, pending] = useActionState(replaceAction, IDLE);
  const fid = useId();
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-xs"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Trocar o arquivo ou corrigir o texto
        </h2>
        <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
          Anexou o arquivo errado? Escolha o certo: ele vira a versão nova e a
          anterior fica guardada, fora da base. Sem arquivo, o texto abaixo,
          como estiver, vira a versão nova.
        </p>
      </div>
      <input type="hidden" name="id" value={id} />
      {request && <input type="hidden" name="pedido" value={request} />}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${fid}-arq`}>Arquivo certo</Label>
        <Input id={`${fid}-arq`} name="arquivo" type="file" accept={ACCEPT} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${fid}-txt`}>Texto em Markdown</Label>
        <Textarea
          id={`${fid}-txt`}
          name="texto"
          rows={16}
          defaultValue={markdown}
          className="font-mono text-xs"
        />
      </div>
      <Justification />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando a versão nova..." : "Guardar a versão nova"}
        </Button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

export function ConfirmSourceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(confirmAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Conferi: usar esta fonte"
      triggerClassName={buttonVariants({ size: "sm" })}
      question="Confirmar esta fonte?"
      consequence="Os alertas foram conferidos e a fonte passa a ser usada pelo Assistente Virtual e na pesquisa."
      confirmLabel="Confirmar"
      pendingLabel="Confirmando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RemoveSourceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Excluir"
      question="Excluir esta fonte?"
      consequence="Ela sai da base e da pesquisa, mas fica guardada, com quem excluiu, quando e por quê, e pode ser estornada."
      confirmLabel="Excluir"
      pendingLabel="Excluindo..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

export function RestoreSourceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(restoreAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Estornar a exclusão"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Trazer esta fonte de volta?"
      consequence="Ela volta para a base e para a pesquisa."
      confirmLabel="Estornar"
      pendingLabel="Estornando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}

/** The AI's fixed task; no question is typed. */
export function CheckSourceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(checkAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending
          ? "Conferindo nos sites oficiais..."
          : "Conferir na fonte oficial (Assistente Virtual)"}
      </Button>
      <ErrorLine state={state} />
    </form>
  );
}

export function DismissRequestButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(dismissRequestAction, IDLE);
  return (
    <ConfirmAction
      action={action}
      pending={pending}
      error={state.status === "error" ? state.message : null}
      trigger="Dispensar"
      triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
      question="Dispensar este pedido?"
      consequence="O pedido fica guardado como dispensado, com o motivo."
      confirmLabel="Dispensar"
      pendingLabel="Dispensando..."
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmAction>
  );
}
