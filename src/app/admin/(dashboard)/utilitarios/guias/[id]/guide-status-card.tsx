"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  GUIDE_STATUS_HINTS,
  GUIDE_STATUS_LABELS,
  GUIDE_STATUSES,
  type GuideStatus,
} from "@/core/guides/status.ts";
import { ConfirmAction } from "../../../../_components/confirm-action.tsx";
import { FilePicker } from "../../../../_components/file-picker.tsx";
import { AdminIcon } from "../../../../_components/icon.tsx";
import { Button, buttonVariants } from "../../../../_ui/button.tsx";
import { cn } from "../../../../_ui/cn.ts";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import {
  type GuideStatusFormState,
  saveGuideStatusAction,
  withdrawGuideReceiptAction,
  withdrawGuideStatusAction,
} from "../actions.ts";

export interface GuideStatusView {
  status: GuideStatus;
  dueOn: string;
  paidOn: string;
  concludedOn: string;
  note: string;
  receipt: { displayName: string; href: string } | null;
  /** "Paga em 20/11/2026, com comprovante", for the summary line. */
  summary: string;
  /** Whether anything was ever saved (the first step is implicit). */
  saved: boolean;
  /** Earlier versions, newest first, already in words. */
  history: { at: string; text: string; receiptHref: string | null }[];
}

const idle: GuideStatusFormState = { status: "idle" };

const TONE: Record<GuideStatus, string> = {
  "aguardando-pagamento": "border-warning/40 bg-warning-soft text-warning-text",
  paga: "border-info/40 bg-info-soft text-info",
  concluida: "border-success/40 bg-success-soft text-success-text",
};

/**
 * Where the guia stands, in three steps, with the comprovante of payment
 * (decision of 22/11/2026). Each step is a button; the days and the
 * comprovante follow the step chosen. Correcting keeps the earlier version
 * in the history; "voltar para aguardando" and "tirar o comprovante" ask
 * first and keep what they undo.
 */
export function GuideStatusCard({
  guideId,
  view,
  today,
  keptUntil,
  overdue,
}: {
  guideId: string;
  view: GuideStatusView;
  today: string;
  /** "22/11/2027": the end of the year the platform keeps the guia. */
  keptUntil: string;
  overdue: boolean;
}) {
  const ids = { due: useId(), paid: useId(), done: useId(), note: useId() };
  const [step, setStep] = useState<GuideStatus>(view.status);
  const [editing, setEditing] = useState(!view.saved);
  const [save, saveAction, saving] = useActionState(
    saveGuideStatusAction,
    idle,
  );
  const [back, backAction, goingBack] = useActionState(
    withdrawGuideStatusAction,
    idle,
  );
  const [unreceipt, unreceiptAction, unreceipting] = useActionState(
    withdrawGuideReceiptAction,
    idle,
  );

  useEffect(() => {
    if (save.status === "saved") {
      toast.success(save.message);
      setEditing(false);
    }
    if (save.status === "error") toast.error(save.message);
  }, [save]);
  useEffect(() => {
    if (back.status === "saved") {
      toast.success(back.message);
      setStep("aguardando-pagamento");
    }
  }, [back]);
  useEffect(() => {
    if (unreceipt.status === "saved") toast.success(unreceipt.message);
  }, [unreceipt]);

  const fieldError = (name: string) =>
    save.status === "error" ? save.fieldErrors[name] : undefined;
  const currentIndex = GUIDE_STATUSES.indexOf(view.status);

  return (
    <section
      aria-labelledby="situacao-da-guia"
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/30 bg-card px-5 py-4"
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="mr-auto">
          <h2
            id="situacao-da-guia"
            className="text-base font-semibold text-foreground"
          >
            Situação da guia
          </h2>
          <p className="text-xs text-muted-foreground">
            O sistema guarda esta guia até <strong>{keptUntil}</strong> (12
            meses após a emissão). Antes disso, baixe e salve no arquivo da
            serventia.
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-semibold",
            TONE[view.status],
          )}
        >
          {GUIDE_STATUS_LABELS[view.status]}
        </span>
      </header>

      {/* The three steps, in order, the current one marked. */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {GUIDE_STATUSES.map((status, index) => (
          <li
            key={status}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2.5",
              index <= currentIndex ? TONE[status] : "bg-muted/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                index <= currentIndex
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {index < currentIndex ? "✓" : index + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">
                {GUIDE_STATUS_LABELS[status]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {GUIDE_STATUS_HINTS[status]}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-foreground">
        {view.summary}.{view.note ? ` ${view.note}` : ""}
      </p>
      {overdue && (
        <p className="rounded-lg bg-warning px-3 py-2 text-sm font-semibold text-warning-foreground">
          O prazo para pagar passou e a guia ainda não foi marcada como paga.
          Confira com a parte.
        </p>
      )}
      {view.receipt && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AdminIcon name="checkCircle" className="h-4 w-4 text-success" />
          <a
            href={view.receipt.href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            {view.receipt.displayName}
          </a>
          <ConfirmAction
            action={unreceiptAction}
            pending={unreceipting}
            error={unreceipt.status === "error" ? unreceipt.message : null}
            trigger="Tirar o comprovante"
            triggerClassName={buttonVariants({ variant: "ghost", size: "sm" })}
            question="Tirar o comprovante desta guia?"
            consequence="O comprovante deixa de aparecer na guia. O arquivo continua no histórico e na auditoria."
            confirmLabel="Tirar"
            pendingLabel="Tirando..."
          >
            <input type="hidden" name="guideId" value={guideId} />
          </ConfirmAction>
        </div>
      )}

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            Alterar a situação
          </Button>
          {view.status !== "aguardando-pagamento" && (
            <ConfirmAction
              action={backAction}
              pending={goingBack}
              error={back.status === "error" ? back.message : null}
              trigger="Voltar para aguardando pagamento"
              triggerClassName={buttonVariants({
                variant: "outline",
                size: "sm",
              })}
              question="Voltar a guia para aguardando pagamento?"
              consequence="A marcação de paga ou concluída sai da guia e fica no histórico e na auditoria."
              confirmLabel="Voltar"
              pendingLabel="Voltando..."
              justify={false}
            >
              <input type="hidden" name="guideId" value={guideId} />
            </ConfirmAction>
          )}
        </div>
      ) : (
        <form
          action={saveAction}
          className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4"
        >
          <input type="hidden" name="guideId" value={guideId} />
          <input type="hidden" name="status" value={step} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              Em que situação está?
            </legend>
            <div className="flex flex-wrap gap-2">
              {GUIDE_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={step === status}
                  onClick={() => setStep(status)}
                  className={buttonVariants({
                    variant: step === status ? "default" : "outline",
                    size: "sm",
                  })}
                >
                  {GUIDE_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.due}>Vence em (opcional)</Label>
              <Input
                id={ids.due}
                name="dueOn"
                type="date"
                defaultValue={view.dueOn}
              />
              <span className="text-xs text-muted-foreground">
                O último dia para pagar, como está na guia ou no boleto.
              </span>
            </div>
            {step !== "aguardando-pagamento" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.paid}>Paga em</Label>
                <Input
                  id={ids.paid}
                  name="paidOn"
                  type="date"
                  required
                  max={today}
                  defaultValue={view.paidOn || today}
                  aria-invalid={Boolean(fieldError("paidOn"))}
                />
                {fieldError("paidOn") && (
                  <span className="text-xs text-destructive">
                    {fieldError("paidOn")}
                  </span>
                )}
              </div>
            )}
            {step === "concluida" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={ids.done}>Usada no ato em</Label>
                <Input
                  id={ids.done}
                  name="concludedOn"
                  type="date"
                  required
                  max={today}
                  defaultValue={view.concludedOn || today}
                  aria-invalid={Boolean(fieldError("concludedOn"))}
                />
                {fieldError("concludedOn") && (
                  <span className="text-xs text-destructive">
                    {fieldError("concludedOn")}
                  </span>
                )}
              </div>
            )}
          </div>
          {step !== "aguardando-pagamento" && (
            <FilePicker
              name="receipt"
              accept="application/pdf,image/*"
              label={
                view.receipt
                  ? "Trocar o comprovante de pagamento (opcional)"
                  : "Comprovante de pagamento"
              }
              hint="PDF ou foto do comprovante do banco ou da prefeitura. Fica guardado com a guia."
            />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.note}>Observação (opcional)</Label>
            <Input
              id={ids.note}
              name="note"
              maxLength={2000}
              defaultValue={view.note}
              placeholder="Ex.: pago na agência; escritura do livro 12, folha 40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar situação"}
            </Button>
            {view.saved && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(view.status);
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      {view.history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Histórico ({view.history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {view.history.map((h) => (
              <li
                key={`${h.at}-${h.text}`}
                className="text-xs text-muted-foreground"
              >
                {h.at}: {h.text}
                {h.receiptHref && (
                  <>
                    {" "}
                    <a
                      href={h.receiptHref}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      ver comprovante
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
