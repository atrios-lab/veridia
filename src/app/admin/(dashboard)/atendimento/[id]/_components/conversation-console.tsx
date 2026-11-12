"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CANNED_RESPONSES } from "@/core/chat/canned-responses.ts";
import { closedByForStaff } from "@/core/chat/closing.ts";
import type { Colleague } from "@/lib/chat.ts";
import { shakeElement } from "../../../../../_components/shake.ts";
import { CHAT_SHAKE_TARGET_ID } from "../../../../_components/chat-alerts.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Input } from "../../../../_ui/input.tsx";
import {
  type ActionState,
  nudgeCitizenAction,
  registerNoteAction,
  sendStaffMessageAction,
} from "../actions.ts";
import { CloseDialog } from "./close-dialog.tsx";
import { TransferDialog } from "./transfer-dialog.tsx";

const POLL_MS = 3000;

interface MessageView {
  id: string;
  authorType: "citizen" | "staff" | "system" | "note";
  authorUserId?: string | null;
  body: string;
  attachment: { displayName: string | null } | null;
  createdAt: string;
}

export function ConversationConsole({
  conversationId,
  initialMessages,
  initialStatus,
  initialClosedReason,
  colleagues,
  currentUserId,
  matchedRequestId,
}: {
  conversationId: string;
  initialMessages: MessageView[];
  initialStatus: string;
  initialClosedReason: string | null;
  colleagues: Colleague[];
  currentUserId: string;
  matchedRequestId: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [closedReason, setClosedReason] = useState(initialClosedReason);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const lastAt = useRef(initialMessages.at(-1)?.createdAt);

  const poll = useCallback(async () => {
    const after = lastAt.current;
    const url = after
      ? `/api/chat/${conversationId}?after=${encodeURIComponent(after)}`
      : `/api/chat/${conversationId}`;
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    setStatus(data.conversation.status);
    setClosedReason(data.conversation.closedReason ?? null);
    if (data.messages.length > 0) {
      lastAt.current = data.messages.at(-1).createdAt;
      // The `after` cursor is a millisecond ISO string round-tripped from a
      // microsecond-precision Postgres timestamp, so it can fail to exclude
      // the very row it came from: the same message would then come back
      // on every poll. De-duping by id here is what actually guarantees no
      // repeats, regardless of that precision loss.
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [
          ...prev,
          ...data.messages.filter((m: MessageView) => !seen.has(m.id)),
        ];
      });
    }
  }, [conversationId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  const [messageState, messageAction, messagePending] = useActionState<
    ActionState,
    FormData
  >(sendStaffMessageAction, { status: "idle" });
  const [noteState, noteAction, notePending] = useActionState<
    ActionState,
    FormData
  >(registerNoteAction, { status: "idle" });

  const [draft, setDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (messageState.status === "success") {
      setDraft("");
      poll();
    }
  }, [messageState, poll]);
  useEffect(() => {
    if (noteState.status === "success") poll();
  }, [noteState, poll]);

  const closed = status === "closed";

  // "Chamar atenção" for the citizen, as many times as the office wants.
  // The attendant's own screen shakes too, the way the messenger did for
  // whoever sent it: the press is felt, not just clicked.
  const [nudging, setNudging] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  async function nudge() {
    setNudging(true);
    setNudgeError(null);
    const result = await nudgeCitizenAction(conversationId);
    setNudging(false);
    if (result.status === "error") {
      setNudgeError(result.message);
      return;
    }
    shakeElement(document.getElementById(CHAT_SHAKE_TARGET_ID));
    poll();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* A finished conversation shows who ended it and the way out, in
          place of the toolbar and the composer: a screen of grey buttons
          reads as frozen, and the attendant has nothing left to do here. */}
      {closed ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text md:px-8">
          <AdminIcon name="chat" className="h-4.5 w-4.5 flex-none" />
          <span className="flex-1 font-semibold">
            {closedByForStaff(closedReason)}
          </span>
          <Link
            href="/admin/atendimento"
            className={buttonVariants({ size: "sm" })}
          >
            Voltar para a fila
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5 border-b bg-card px-4 py-3 md:px-8">
          <Button
            type="button"
            size="sm"
            onClick={() => void nudge()}
            disabled={nudging}
            title="Faz a tela do cidadão tremer e tocar"
          >
            {nudging ? "Chamando…" : "Chamar atenção"}
          </Button>
          {nudgeError && (
            <span className="text-xs font-medium text-destructive">
              {nudgeError}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowTransfer((v) => !v)}
          >
            Transferir
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowClose((v) => !v)}
          >
            Encerrar conversa
          </Button>
        </div>
      )}

      {showTransfer && !closed && (
        <TransferDialog
          conversationId={conversationId}
          colleagues={colleagues.filter((c) => c.id !== currentUserId)}
          onDone={() => setShowTransfer(false)}
        />
      )}
      {showClose && !closed && (
        <CloseDialog
          conversationId={conversationId}
          matchedRequestId={matchedRequestId}
          onCancel={() => setShowClose(false)}
        />
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-muted/50 p-4">
        {messages.length === 0 ? (
          <p className="self-center py-6 text-center text-sm text-muted-foreground">
            Ainda não há mensagens nesta conversa.
          </p>
        ) : (
          messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))
        )}
      </div>

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3.5 text-sm text-muted-foreground md:px-8">
          <span>
            Conversa finalizada. A transcrição fica guardada por 6 meses.
          </span>
          <Link
            href="/admin/atendimento"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Fechar
          </Link>
        </div>
      ) : (
        <div className="border-t bg-card px-4 py-3.5 md:px-8">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {CANNED_RESPONSES.map((canned) => (
              <button
                key={canned.key}
                type="button"
                onClick={() => setDraft(canned.text)}
                className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {canned.label}
              </button>
            ))}
          </div>
          <form
            ref={formRef}
            action={messageAction}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="conversationId" value={conversationId} />
            <Input
              name="body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escreva sua mensagem…"
              className="flex-1 bg-background"
            />
            <Button type="submit" disabled={messagePending}>
              {messagePending ? "Enviando…" : "Enviar"}
            </Button>
          </form>
          {messageState.status === "error" && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {messageState.message}
            </p>
          )}

          <form action={noteAction} className="mt-2.5 flex items-center gap-2">
            <input type="hidden" name="conversationId" value={conversationId} />
            <Input
              name="note"
              placeholder="Nota interna · só a equipe vê"
              className="flex-1 border-warning/30 bg-warning-soft"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={notePending}
              className="border-warning/30 bg-warning-soft text-warning-text hover:bg-warning-soft hover:text-warning-text"
            >
              {notePending ? "Salvando…" : "+ Nota"}
            </Button>
          </form>
          {noteState.status === "error" && (
            <p className="mt-1.5 text-xs font-medium text-destructive">
              {noteState.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: MessageView }) {
  if (message.authorType === "system") {
    return (
      <div className="self-center rounded-full border bg-card px-3 py-1 text-center text-xs text-muted-foreground">
        {message.body}
      </div>
    );
  }
  if (message.authorType === "note") {
    return (
      <div className="max-w-[74%] self-stretch rounded-lg border border-l-4 border-warning/30 border-l-warning bg-warning-soft px-3.5 py-2.5">
        <div className="text-xs font-medium text-warning-text">
          Nota interna · só a equipe vê
        </div>
        <p className="mt-1 text-sm text-foreground">{message.body}</p>
      </div>
    );
  }
  const fromStaff = message.authorType === "staff";
  return (
    <div
      className={cn(
        "max-w-[74%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
        fromStaff
          ? "self-end rounded-br-sm bg-primary text-primary-foreground"
          : "self-start rounded-bl-sm border bg-card text-foreground",
      )}
    >
      {message.attachment ? (
        <span className="flex items-center gap-2">
          <AdminIcon name="file" className="h-4 w-4 flex-none" />
          {message.attachment.displayName}
        </span>
      ) : (
        message.body
      )}
    </div>
  );
}
