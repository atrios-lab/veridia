"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { Badge } from "../../../../_ui/badge.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { conversationAction, type DetailState } from "./actions.ts";

/** One entry as the panel shows it: already filtered to the shown ones. */
export interface ConversationEntry {
  id: string;
  kind: "requirement" | "message";
  authorType: "office" | "citizen";
  authorName: string;
  body: string;
  atLabel: string;
  edited: boolean;
  resolved: boolean;
}

const IDLE: DetailState = { status: "idle" };

function useToast(state: DetailState, onSuccess?: () => void) {
  const last = useRef(state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new state reports
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    }
    if (state.status === "error") toast.error(state.message);
  }, [state]);
}

/** Editar, Apagar and, for an exigência, Cumprida / Reabrir. */
function EntryActions({
  appointmentId,
  entry,
  onEdit,
}: {
  appointmentId: string;
  entry: ConversationEntry;
  onEdit: () => void;
}) {
  const [state, action, pending] = useActionState(conversationAction, IDLE);
  useToast(state);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.kind === "requirement" && (
        <form action={action}>
          <input type="hidden" name="id" value={appointmentId} />
          <input type="hidden" name="entryId" value={entry.id} />
          <input
            type="hidden"
            name="op"
            value={entry.resolved ? "reopen" : "met"}
          />
          <Button
            type="submit"
            size="sm"
            variant={entry.resolved ? "outline" : "default"}
            disabled={pending}
          >
            {entry.resolved ? "Reabrir" : "Marcar cumprida"}
          </Button>
        </form>
      )}
      {entry.authorType === "office" && (
        <>
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            Editar
          </Button>
          <ConfirmAction
            action={action}
            pending={pending}
            error={state.status === "error" ? state.message : null}
            trigger="Apagar"
            question={
              entry.kind === "requirement"
                ? "Apagar esta exigência?"
                : "Apagar esta mensagem?"
            }
            consequence="Some para o cliente na consulta do protocolo. O registro e o texto ficam guardados na auditoria."
            confirmLabel="Apagar"
            pendingLabel="Apagando…"
          >
            <input type="hidden" name="id" value={appointmentId} />
            <input type="hidden" name="entryId" value={entry.id} />
            <input type="hidden" name="op" value="hide" />
          </ConfirmAction>
        </>
      )}
    </div>
  );
}

function EditForm({
  appointmentId,
  entry,
  onDone,
}: {
  appointmentId: string;
  entry: ConversationEntry;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(conversationAction, IDLE);
  useToast(state, onDone);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="entryId" value={entry.id} />
      <input type="hidden" name="op" value="edit" />
      <Textarea
        name="body"
        rows={3}
        defaultValue={entry.body}
        maxLength={LONG_TEXT_MAX}
        aria-label="Novo texto"
        className="field-sizing-fixed bg-background"
      />
      <p className="text-xs text-muted-foreground">
        O cliente passa a ver o texto novo. O anterior fica guardado.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alteração"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Entry({
  appointmentId,
  entry,
}: {
  appointmentId: string;
  entry: ConversationEntry;
}) {
  const [editing, setEditing] = useState(false);
  const citizen = entry.authorType === "citizen";
  return (
    <li
      className={cn(
        "rounded-lg border px-3.5 py-3",
        citizen ? "border-info/30 bg-info-soft" : "bg-background",
        entry.kind === "requirement" &&
          !entry.resolved &&
          "border-warning/50 bg-warning-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {citizen ? `${entry.authorName} (cliente)` : entry.authorName}
        </span>
        <span>{entry.atLabel}</span>
        {entry.edited && <span>· alterado</span>}
        {entry.kind === "requirement" && (
          <Badge
            className={
              entry.resolved
                ? "bg-success text-success-foreground"
                : "bg-warning text-warning-foreground"
            }
          >
            {entry.resolved ? "Cumprida" : "Aguardando o cliente"}
          </Badge>
        )}
      </div>
      {editing ? (
        <EditForm
          appointmentId={appointmentId}
          entry={entry}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <p className="mt-1 text-sm whitespace-pre-line text-foreground">
            {entry.body}
          </p>
          {(entry.kind === "requirement" || !citizen) && (
            <div className="mt-2">
              <EntryActions
                appointmentId={appointmentId}
                entry={entry}
                onEdit={() => setEditing(true)}
              />
            </div>
          )}
        </>
      )}
    </li>
  );
}

function WriteForm({
  appointmentId,
  op,
  label,
  placeholder,
  submit,
}: {
  appointmentId: string;
  op: "requirement" | "message";
  label: string;
  placeholder: string;
  submit: string;
}) {
  const [state, action, pending] = useActionState(conversationAction, IDLE);
  const form = useRef<HTMLFormElement>(null);
  useToast(state, () => form.current?.reset());
  return (
    <form ref={form} action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="op" value={op} />
      <label
        htmlFor={`write-${op}`}
        className="text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <Textarea
        id={`write-${op}`}
        name="body"
        rows={3}
        maxLength={LONG_TEXT_MAX}
        placeholder={placeholder}
        className="field-sizing-fixed bg-background"
      />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : submit}
        </Button>
      </div>
    </form>
  );
}

function QuestionsSwitch({
  appointmentId,
  open,
}: {
  appointmentId: string;
  open: boolean;
}) {
  const [state, action, pending] = useActionState(conversationAction, IDLE);
  useToast(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="op" value={open ? "close" : "open"} />
      <Button
        type="submit"
        size="sm"
        variant={open ? "outline" : "default"}
        disabled={pending}
      >
        {open ? "Fechar perguntas" : "Abrir perguntas"}
      </Button>
    </form>
  );
}

/**
 * "Exigência e perguntas ao cliente" (decision of 24/11/2026): what the
 * office asks the citizen to send before the visit, and the questions it
 * opens and closes itself, so the citizen writes only while it allows.
 */
export function ConversationCard({
  appointmentId,
  entries,
  questionsOpen,
  awaiting,
  appointmentOpen,
}: {
  appointmentId: string;
  entries: ConversationEntry[];
  questionsOpen: boolean;
  /** The citizen wrote last and nobody answered yet. */
  awaiting: boolean;
  /** Booked and still ahead: the citizen can still send and answer. */
  appointmentOpen: boolean;
}) {
  const requirements = entries.filter((entry) => entry.kind === "requirement");
  const messages = entries.filter((entry) => entry.kind === "message");
  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <h3 className="text-sm font-semibold text-foreground">
        Exigência e perguntas ao cliente
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        O cliente vê e responde pela consulta do protocolo do agendamento, com a
        chave de acesso, e recebe um e-mail a cada exigência ou mensagem sua.
      </p>

      <h4 className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Exigência
      </h4>
      {requirements.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {requirements.map((entry) => (
            <Entry key={entry.id} appointmentId={appointmentId} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma exigência. Abra uma se precisar de um documento ou de uma
          providência antes do atendimento: o cliente envia pela consulta.
        </p>
      )}
      {appointmentOpen && (
        <WriteForm
          appointmentId={appointmentId}
          op="requirement"
          label="Pedir documento ou providência"
          placeholder="Ex.: envie em PDF a certidão de casamento atualizada (até 90 dias)."
          submit="Abrir exigência"
        />
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Perguntas e respostas
        </h4>
        <span className="flex items-center gap-2">
          <Badge
            className={
              questionsOpen
                ? "bg-success text-success-foreground"
                : "bg-muted text-muted-foreground"
            }
          >
            {questionsOpen
              ? "Abertas: o cliente pode responder"
              : "Fechadas: o cliente só lê"}
          </Badge>
          {appointmentOpen && (
            <QuestionsSwitch
              appointmentId={appointmentId}
              open={questionsOpen}
            />
          )}
        </span>
      </div>
      {awaiting && (
        <p className="mt-2 text-xs font-medium text-warning-text">
          O cliente escreveu e está esperando resposta.
        </p>
      )}
      {messages.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {messages.map((entry) => (
            <Entry key={entry.id} appointmentId={appointmentId} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma pergunta. Escreva ao cliente quando quiser só tirar uma
          dúvida: as perguntas se abrem e ele pode responder. Depois, feche para
          ele não continuar escrevendo.
        </p>
      )}
      {appointmentOpen && (
        <WriteForm
          appointmentId={appointmentId}
          op="message"
          label="Escrever ao cliente"
          placeholder="Ex.: o imóvel tem matrícula própria ou ainda é posse?"
          submit="Enviar"
        />
      )}
    </section>
  );
}
