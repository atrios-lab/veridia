"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { Colleague } from "@/lib/chat.ts";
import { AdminDialog, DIALOG_FOOTER } from "../../../../_components/dialog.tsx";
import { Button } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
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
            className="text-lg leading-snug font-semibold text-foreground"
          >
            Transferir atendimento
          </h2>
          <input type="hidden" name="conversationId" value={conversationId} />
          <div className="flex flex-col gap-1.5">
            {colleagues.map((colleague) => (
              <label
                key={colleague.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                  toUserId === colleague.id
                    ? "border-primary bg-muted/50"
                    : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="toUserId"
                  value={colleague.id}
                  checked={toUserId === colleague.id}
                  onChange={() => setToUserId(colleague.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {colleague.name}
                  </span>
                  {colleague.chatSector && (
                    <span className="block text-xs text-muted-foreground">
                      {colleague.chatSector}
                    </span>
                  )}
                </span>
                <span className="flex-none text-xs font-medium text-muted-foreground">
                  {STATUS_LABEL[colleague.chatStatus] ?? colleague.chatStatus}
                  {" · "}
                  {colleague.activeCount} conversa
                  {colleague.activeCount === 1 ? "" : "s"}
                </span>
              </label>
            ))}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                toUserId === ""
                  ? "border-primary bg-muted/50"
                  : "hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="toUserId"
                value=""
                checked={toUserId === ""}
                onChange={() => setToUserId("")}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium text-foreground">
                Devolver à fila geral
              </span>
            </label>
          </div>
          <div>
            <Label className="mb-1.5 block" htmlFor="transfer-note">
              Nota interna <span className="text-destructive">*</span>{" "}
              <span className="font-normal text-muted-foreground">
                (por que está transferindo)
              </span>
            </Label>
            <Textarea
              id="transfer-note"
              name="note"
              required
              rows={2}
              className="border-warning/30 bg-warning-soft"
            />
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
        </div>
        <div className={DIALOG_FOOTER}>
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Transferindo…" : "Transferir"}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
