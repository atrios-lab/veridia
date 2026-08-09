"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Colleague } from "@/lib/chat.ts";
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

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Conversa transferida.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <div className="border-b border-admin-border bg-admin-card px-5.5 py-4.5">
      <h3 className="font-serif text-[16px] font-semibold text-admin-primary">
        Transferir atendimento
      </h3>
      <form action={formAction} className="mt-3.5 flex flex-col gap-3.5">
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
          <p className="text-[12px] font-semibold text-admin-error-text">
            {state.message}
          </p>
        )}
        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-admin-primary-soft px-4.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-70"
          >
            Transferir
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-[10px] border border-admin-input-border px-4 py-2.5 text-[12.5px] font-bold text-admin-muted"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
