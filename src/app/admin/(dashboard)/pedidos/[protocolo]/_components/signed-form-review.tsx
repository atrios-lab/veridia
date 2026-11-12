"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../../../../_ui/button.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { Textarea } from "../../../../_ui/textarea.tsx";
import { type ActionState, returnSignedFormAction } from "../actions.ts";

/**
 * The signed requerimento of a pedido from the site, before it reaches the
 * office (decision of 12/11/2026). Signed digitally and ours, the system
 * frees the pedido by itself; a scan or a photo waits here: the office
 * frees it by the andamento ("Requerimento conferido: liberar o pedido")
 * or sends it back with the reason.
 */
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
  } | null;
  hasFile: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    returnSignedFormAction,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "success") {
      toast.success("Requerimento devolvido. O solicitante foi avisado.");
      if (state.emailWarning) toast.warning(state.emailWarning);
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
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-foreground">
          <strong className="font-semibold">Devolvido</strong> em{" "}
          {check.checkedAtLabel}: {check.returnedReason?.replace(/\.+$/, "")}.
          Aguardando o novo arquivo do solicitante.
        </p>
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
              Não está correto? Devolva com o motivo
            </Label>
            <Textarea
              id="sf-motivo"
              name="motivo"
              rows={2}
              maxLength={5000}
              placeholder="Ex.: assinatura a punho sem firma reconhecida."
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
    </section>
  );
}
