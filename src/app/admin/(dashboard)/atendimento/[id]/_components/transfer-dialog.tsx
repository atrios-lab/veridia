"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { Colleague } from "@/lib/chat.ts";
import { AdminDialog, DIALOG_FOOTER } from "../../../../_components/dialog.tsx";
import { type ActionState, transferConversationAction } from "../actions.ts";

const STATUS_LABEL: Record<string, string> = {
  available: "Disponível",
  busy: "Ocupado",
  away: "Ausente",
};

export function TransferDialog({
  conversationId,
  colleagues,
  onDone,
}: {
  conversationId: string;
  colleagues: Colleague[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    transferConversationAction,
    { status: "idle" },
  );
  const [toUserId, setToUserId] = useState<string>("");
  const headingId = useId();

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Conversa transferida.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <AdminDialog
      labelledBy={headingId}
      onClose={() => {
        if (!pending) onDone();
      }}
    >
      <form action={formAction}>
        <div className="dialog-body flex flex-col gap-3.5">
          <h2
            id={headingId}
            className="font-serif text-[18px] font-semibold text-admin-primary"
          >
            Transferir atendimento
          </h2>
          <input type="hidden" name="conversationId" value={conversationId} />
          <div className="flex flex-col gap-1.5">
            {colleagues.map((colleague) => (
              <label
                key={colleague.id}
                className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
                  toUserId === colleague.id
                    ? "border-admin-primary-soft bg-admin-input-bg"
                    : "border-admin-border"
                }`}
              >
                <input
                  type="radio"
                  name="toUserId"
                  value={colleague.id}
                  checked={toUserId === colleague.id}
                  onChange={() => setToUserId(colleague.id)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-admin-text">
                    {colleague.name}
                  </span>
                  {colleague.chatSector && (
                    <span className="block text-[11.5px] text-admin-faint">
                      {colleague.chatSector}
                    </span>
                  )}
                </span>
                <span className="flex-none text-[11.5px] font-bold text-admin-muted">
                  {STATUS_LABEL[colleague.chatStatus] ?? colleague.chatStatus}
                  {" · "}
                  {colleague.activeCount} conversa
                  {colleague.activeCount === 1 ? "" : "s"}
                </span>
              </label>
            ))}
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${
                toUserId === ""
                  ? "border-admin-primary-soft bg-admin-input-bg"
                  : "border-admin-border"
              }`}
            >
              <input
                type="radio"
                name="toUserId"
                value=""
                checked={toUserId === ""}
                onChange={() => setToUserId("")}
                className="h-4 w-4"
              />
              <span className="text-[13px] font-bold text-admin-text">
                Devolver à fila geral
              </span>
            </label>
          </div>
          <div>
            <label
              className="mb-1.5 block text-[12px] font-bold text-admin-primary"
              htmlFor="transfer-note"
            >
              Nota interna <span className="text-admin-error-text">*</span>{" "}
              <span className="font-medium text-admin-faint">
                (por que está transferindo)
              </span>
            </label>
            <textarea
              id="transfer-note"
              name="note"
              required
              rows={2}
              className="w-full rounded-[10px] border border-admin-warning-bg bg-admin-warning-bg px-3.5 py-2.5 text-[13px] outline-none"
            />
          </div>
          {state.status === "error" && (
            <p
              role="alert"
              className="text-[12.5px] font-semibold text-admin-error-text"
            >
              {state.message}
            </p>
          )}
        </div>
        <div className={DIALOG_FOOTER}>
          <button
            type="button"
            onClick={onDone}
            disabled={pending}
            className="btn btn-admin-secondary btn-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-admin-primary btn-md"
          >
            {pending ? "Transferindo…" : "Transferir"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
