"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CANNED_RESPONSES } from "@/core/chat/canned-responses.ts";
import type { Colleague } from "@/lib/chat.ts";
import { AdminIcon } from "../../../../_components/icon.tsx";
import {
  type ActionState,
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
  colleagues,
  currentUserId,
  matchedRequestId,
}: {
  conversationId: string;
  initialMessages: MessageView[];
  initialStatus: string;
  colleagues: Colleague[];
  currentUserId: string;
  matchedRequestId: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 border-b border-admin-border bg-admin-card px-5.5 py-3">
        <button
          type="button"
          onClick={() => setShowTransfer((v) => !v)}
          disabled={closed}
          className="btn btn-admin-secondary btn-sm"
        >
          Transferir
        </button>
        <button
          type="button"
          onClick={() => setShowClose((v) => !v)}
          disabled={closed}
          className="btn btn-admin-danger btn-sm"
        >
          {closed ? "Conversa encerrada" : "Encerrar conversa"}
        </button>
      </div>

      {showTransfer && (
        <TransferDialog
          conversationId={conversationId}
          colleagues={colleagues.filter((c) => c.id !== currentUserId)}
          onDone={() => setShowTransfer(false)}
        />
      )}
      {showClose && (
        <CloseDialog
          conversationId={conversationId}
          matchedRequestId={matchedRequestId}
          onCancel={() => setShowClose(false)}
        />
      )}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-admin-input-bg p-4">
        {messages.length === 0 ? (
          <p className="self-center py-6 text-center text-[13px] text-admin-muted">
            Ainda não há mensagens nesta conversa.
          </p>
        ) : (
          messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))
        )}
      </div>

      <div className="border-t border-admin-border bg-admin-card p-3.5">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {CANNED_RESPONSES.map((canned) => (
            <button
              key={canned.key}
              type="button"
              onClick={() => setDraft(canned.text)}
              className="rounded-full border border-admin-input-border bg-admin-input-bg px-3 py-1 text-[11.5px] font-semibold text-admin-muted hover:text-admin-primary"
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
          <input
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={closed}
            placeholder="Escreva sua mensagem…"
            className="min-w-0 flex-1 rounded-[10px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] outline-none focus:border-admin-primary-soft disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={closed || messagePending}
            className="btn btn-admin-primary btn-md"
          >
            {messagePending ? "Enviando…" : "Enviar"}
          </button>
        </form>
        {messageState.status === "error" && (
          <p className="mt-1.5 text-[11.5px] font-semibold text-admin-error-text">
            {messageState.message}
          </p>
        )}

        <form action={noteAction} className="mt-2.5 flex items-center gap-2">
          <input type="hidden" name="conversationId" value={conversationId} />
          <input
            name="note"
            disabled={closed}
            placeholder="Nota interna · só a equipe vê"
            className="min-w-0 flex-1 rounded-[10px] border border-admin-warning-bg bg-admin-warning-bg px-3.5 py-2 text-[12.5px] outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={closed || notePending}
            className="rounded-[10px] border border-admin-warning-bg bg-admin-warning-bg px-3.5 py-2 text-[12px] font-bold text-admin-warning-text disabled:opacity-60"
          >
            {notePending ? "Salvando…" : "+ Nota"}
          </button>
        </form>
        {noteState.status === "error" && (
          <p className="mt-1.5 text-[11.5px] font-semibold text-admin-error-text">
            {noteState.message}
          </p>
        )}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: MessageView }) {
  if (message.authorType === "system") {
    return (
      <div className="self-center rounded-full bg-admin-card px-3 py-1 text-center text-[11px] text-admin-faint">
        {message.body}
      </div>
    );
  }
  if (message.authorType === "note") {
    return (
      <div className="max-w-[74%] self-stretch rounded-[10px] border border-admin-warning-bg border-l-[3px] bg-admin-warning-bg px-3.5 py-2.5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-warning-text">
          Nota interna · só a equipe vê
        </div>
        <p className="mt-1 text-[13px] text-admin-text">{message.body}</p>
      </div>
    );
  }
  const fromStaff = message.authorType === "staff";
  return (
    <div
      className={`max-w-[74%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
        fromStaff
          ? "self-end rounded-br-sm bg-admin-primary text-white"
          : "self-start rounded-bl-sm border border-admin-border bg-admin-card text-admin-text"
      }`}
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
