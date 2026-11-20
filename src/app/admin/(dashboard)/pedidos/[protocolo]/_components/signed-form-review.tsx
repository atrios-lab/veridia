"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import {
  type ActionState,
  editSignedFormReturnAction,
  returnSignedFormAction,
  withdrawSignedFormReturnAction,
} from "../actions.ts";

/**
 * The signed requerimento of a pedido from the site, before it reaches the
 * office (decision of 12/11/2026). Signed digitally and ours, the system
 * frees the pedido by itself; a scan or a photo waits here: the office
 * frees it by the andamento ("Requerimento conferido: liberar o pedido")
 * or sends it back with the reason. The usual reasons are one click away
 * (decision of 19/11/2026), and the card says where to refuse the pedido
 * for good: Indeferir, in the andamento, with its justification.
 */

/** Why a file goes back, in the words the citizen reads. */
const RETURN_REASONS = [
  "A assinatura não é válida.",
  "Assinado a punho, sem firma reconhecida.",
  "Não é o requerimento deste protocolo.",
  "O arquivo está ilegível ou incompleto.",
] as const;
interface ReturnHistoryEntry {
  change: "edited" | "withdrawn";
  previousReason: string;
  atLabel: string;
}

/**
 * A devolução already made, with its options (decision of 20/11/2026):
 * edit the reason, or "apagar" it, which puts the file back to "a
 * conferir". Nothing leaves the database; the old texts stay listed below.
 */
function ReturnedNotice({
  requestId,
  checkedAtLabel,
  reason,
}: {
  requestId: string;
  checkedAtLabel: string;
  reason: string;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "withdraw">("view");
  const [draft, setDraft] = useState(reason);
  const [editState, editAction, editing] = useActionState<
    ActionState,
    FormData
  >(editSignedFormReturnAction, { status: "idle" });
  const [withdrawState, withdrawAction, withdrawing] = useActionState<
    ActionState,
    FormData
  >(withdrawSignedFormReturnAction, { status: "idle" });
  useEffect(() => {
    if (editState.status === "success") {
      toast.success("Motivo da devolução alterado.");
      if (editState.emailWarning) toast.warning(editState.emailWarning);
      setMode("view");
    }
  }, [editState]);
  useEffect(() => {
    if (withdrawState.status === "success") {
      toast.success("Devolução desfeita. O arquivo voltou para a conferência.");
      setMode("view");
    }
  }, [withdrawState]);

  if (mode === "edit") {
    return (
      <form
        action={editAction}
        className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3"
      >
        <input type="hidden" name="requestId" value={requestId} />
        <Label htmlFor="sf-motivo-editar">Motivo da devolução</Label>
        <Textarea
          id="sf-motivo-editar"
          name="motivo"
          rows={3}
          maxLength={5000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="avisar"
            defaultChecked
            className="checkbox-admin"
          />
          Avisar o solicitante por e-mail
        </label>
        {editState.status === "error" && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {editState.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={editing}>
            {editing ? "Salvando..." : "Salvar motivo"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={editing}
            onClick={() => {
              setDraft(reason);
              setMode("view");
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
      <p>
        <strong className="font-semibold">Devolvido</strong> em {checkedAtLabel}
        : {reason.replace(/\.+$/, "")}. Aguardando o novo arquivo do
        solicitante.
      </p>
      {mode === "withdraw" ? (
        <form
          action={withdrawAction}
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-card px-3 py-2.5"
        >
          <input type="hidden" name="requestId" value={requestId} />
          <p>
            Apagar a devolução? O arquivo volta para a conferência, como antes
            de devolver, e o motivo sai da tela do solicitante. O texto fica
            guardado no histórico do pedido.
          </p>
          {withdrawState.status === "error" && (
            <p role="alert" className="font-semibold text-destructive">
              {withdrawState.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={withdrawing}
            >
              {withdrawing ? "Apagando..." : "Sim, apagar a devolução"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={withdrawing}
              onClick={() => setMode("view")}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(reason);
              setMode("edit");
            }}
          >
            Editar motivo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMode("withdraw")}
          >
            Apagar devolução
          </Button>
        </div>
      )}
    </div>
  );
}

function ReturnHistory({ entries }: { entries: ReturnHistoryEntry[] }) {
  if (!entries.length) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">
        Histórico da devolução ({entries.length})
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1">
        {[...entries].reverse().map((entry, index) => (
          <li key={`${entry.atLabel}-${index}`}>
            {entry.atLabel}:{" "}
            {entry.change === "edited"
              ? "motivo alterado"
              : "devolução apagada"}
            . Texto anterior: "{entry.previousReason}"
          </li>
        ))}
      </ul>
    </details>
  );
}

export function SignedFormReview({
  requestId,
  check,
  hasFile,
}: {
  requestId: string;
  check: {
    verdict: string;
    reason: string;
    checkedAtLabel: string;
    returnedReason?: string;
    history?: ReturnHistoryEntry[];
  } | null;
  hasFile: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    returnSignedFormAction,
    { status: "idle" },
  );
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Requerimento devolvido. O solicitante foi avisado.");
      if (state.emailWarning) toast.warning(state.emailWarning);
      setReason("");
    }
  }, [state]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-warning/40 bg-card px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Requerimento assinado
        </h2>
        <p className="text-sm text-muted-foreground">
          Pedido feito pelo site: só segue para o cartório depois que o
          requerimento deste protocolo, assinado, for aceito. Até lá, o prazo
          fica suspenso.
        </p>
      </div>

      {!hasFile || !check ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          O solicitante ainda não enviou o requerimento assinado.
        </p>
      ) : check.verdict === "returned" ? (
        <ReturnedNotice
          requestId={requestId}
          checkedAtLabel={check.checkedAtLabel}
          reason={check.returnedReason ?? ""}
        />
      ) : (
        <>
          <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-text">
            <strong className="font-semibold">A conferir:</strong>{" "}
            {check.reason} Abra o arquivo em "Arquivos do pedido" e confira se é
            o requerimento deste protocolo, assinado e com firma reconhecida.
            Estando correto, use "Requerimento conferido: liberar o pedido" no
            andamento.
          </p>
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="requestId" value={requestId} />
            <Label htmlFor="sf-motivo">
              Assinatura inválida ou arquivo errado? Devolva com o motivo
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {RETURN_REASONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() =>
                    setReason((current) =>
                      current.includes(text)
                        ? current
                        : `${current.trim()} ${text}`.trim(),
                    )
                  }
                  disabled={pending}
                  className="cursor-pointer rounded-full border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {text.replace(/\.$/, "")}
                </button>
              ))}
            </div>
            <Textarea
              id="sf-motivo"
              name="motivo"
              rows={2}
              maxLength={5000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Escolha um motivo acima ou escreva o seu. O solicitante lê este texto."
            />
            {state.status === "error" && (
              <p
                role="alert"
                className="text-sm font-semibold text-destructive"
              >
                {state.message}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={pending}
              className="self-start"
            >
              {pending ? "Devolvendo..." : "Devolver ao solicitante"}
            </Button>
          </form>
        </>
      )}

      <ReturnHistory entries={check?.history ?? []} />

      <p className="text-xs text-muted-foreground">
        Devolver pede outro arquivo e mantém o pedido. Para recusar o pedido de
        vez, use <strong className="font-semibold">Indeferir o pedido</strong>{" "}
        no andamento, com a justificativa: o solicitante a vê na consulta do
        protocolo.
      </p>
    </section>
  );
}
