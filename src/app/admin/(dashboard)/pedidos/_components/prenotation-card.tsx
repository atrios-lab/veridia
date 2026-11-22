"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "../../../_components/confirm-action.tsx";
import { FeeTableReminder } from "../../../_components/fee-table-reminder.tsx";
import { AdminIcon } from "../../../_components/icon.tsx";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  type ActionState,
  confirmPrenotationPaidAction,
  sendPrenotationPixAction,
} from "../[protocolo]/actions.ts";

export interface PrenotationView {
  requestId: string;
  protocolNumber: string;
  amountLabel: string;
  code: string;
  description: string;
  table: { id: string; title: string; year: string } | null;
  /** Null when the office has no Pix key yet. */
  pix: { copyPaste: string; qrSvg: string } | null;
  /** "pending": waiting for the payment; "reported": the citizen sent a
   * comprovante; "paid": confirmed, with when and how. */
  stage: "pending" | "reported" | "paid";
  paidLabel?: string;
  /** Whether the citizen gave an e-mail, to send the Pix to. */
  canEmail: boolean;
  /** Who may update the fee table (the reminder's link). */
  canUpdateTable: boolean;
}

const idle: ActionState = { status: "idle" };

/**
 * The prenotação at the counter and on the detail (decision of 22/11/2026):
 * the value to charge, that nothing moves before the payment, the Pix to
 * show, download or send, and "Pagamento conferido e concluído" for a
 * payment made in front of the clerk. With the "Como fazer" of each step.
 */
export function PrenotationCard({ view }: { view: PrenotationView }) {
  const [showPix, setShowPix] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paid, paidAction, paying] = useActionState(
    confirmPrenotationPaidAction,
    idle,
  );
  const [sent, sendAction, sending] = useActionState(
    sendPrenotationPixAction,
    idle,
  );

  useEffect(() => {
    if (paid.status === "success") {
      toast.success("Pagamento conferido. O pedido foi para a análise.");
    }
  }, [paid]);
  useEffect(() => {
    if (sent.status === "success") {
      if (sent.emailWarning) toast.warning(sent.emailWarning);
      else toast.success("Pix enviado ao cliente por e-mail.");
    }
    if (sent.status === "error") toast.error(sent.message);
  }, [sent]);

  if (view.stage === "paid" || paid.status === "success") {
    return (
      <section className="rounded-xl border border-success/40 bg-success-soft p-5">
        <p className="text-base font-semibold text-success-text">
          Prenotação paga{view.paidLabel ? ` ${view.paidLabel}` : ""}.
        </p>
        <p className="mt-1 text-sm text-foreground">
          {view.amountLabel} (código {view.code}). O título está em análise.
          Depois da análise vem a exigência ou o resultado positivo, e só então
          o valor do ato: informe-o em "Valor do pedido", conforme a tabela
          vigente.
        </p>
      </section>
    );
  }

  async function copyKey() {
    if (!view.pix) return;
    try {
      await navigator.clipboard.writeText(view.pix.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie.");
    }
  }

  /** The QR as a PNG, to send by WhatsApp or print: drawn from the SVG. */
  function downloadQr() {
    if (!view.pix) return;
    const svg = new Blob([view.pix.qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svg);
    const image = new Image();
    image.onload = () => {
      const size = 720;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "white";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Pix-prenotacao-${view.protocolNumber}.png`;
      link.click();
    };
    image.src = url;
  }

  return (
    <section
      aria-labelledby={`prenotacao-${view.requestId}`}
      className="flex flex-col gap-4 rounded-xl border-2 border-warning/50 bg-warning-soft p-5"
    >
      <div className="flex items-start gap-3">
        <AdminIcon
          name="wallet"
          className="mt-0.5 h-5 w-5 shrink-0 text-warning-text"
        />
        <div>
          <h3
            id={`prenotacao-${view.requestId}`}
            className="text-base font-semibold text-foreground"
          >
            Ato com prenotação: cobre o valor da prenotação
          </h3>
          <p className="mt-1 text-sm text-foreground">
            Valor da prenotação: <strong>{view.amountLabel}</strong> (código{" "}
            {view.code}, {view.description}).
          </p>
          <p className="mt-1 text-sm font-semibold text-warning-text">
            {view.stage === "reported"
              ? "O cliente enviou o comprovante. Confira se o valor entrou e confirme: só então o pedido vai para a análise."
              : "O pedido só tem andamento depois do pagamento. Confirmado o pagamento, ele vai para a análise."}
          </p>
        </div>
      </div>

      <FeeTableReminder table={view.table} canUpdate={view.canUpdateTable} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setShowPix((v) => !v)}
          disabled={!view.pix}
        >
          <AdminIcon name="wallet" className="h-4 w-4" />
          {showPix ? "Esconder o pagamento" : "Gerar o pagamento (Pix)"}
        </Button>
        <ConfirmAction
          action={paidAction}
          pending={paying}
          error={paid.status === "error" ? paid.message : null}
          trigger={
            <>
              <AdminIcon name="checkCircle" className="h-4 w-4" /> Pagamento
              conferido e concluído
            </>
          }
          triggerClassName={buttonVariants({ variant: "outline" })}
          question="Confirmar o pagamento da prenotação?"
          consequence={`Confirme só depois de ver o valor de ${view.amountLabel} entrar (no extrato ou no aplicativo do banco) ou de receber o dinheiro no balcão. O pedido vai para a análise e o cliente vê isso na consulta do protocolo. Fica registrado na auditoria com o seu nome.`}
          confirmLabel="Pagamento conferido"
          pendingLabel="Confirmando..."
          justify={false}
        >
          <input type="hidden" name="requestId" value={view.requestId} />
        </ConfirmAction>
      </div>
      {!view.pix && (
        <p className="text-sm text-warning-text">
          Falta cadastrar a chave Pix da serventia em Configurações › Cobrança
          para gerar o QR Code. Enquanto isso, receba no balcão e use "Pagamento
          conferido e concluído".
        </p>
      )}

      {showPix && view.pix && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row">
          <div
            className="mx-auto size-44 shrink-0 rounded-md bg-white p-1"
            // The SVG comes from our own QR library, built from the Pix
            // code on the server: no user markup in it.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: own SVG
            dangerouslySetInnerHTML={{ __html: view.pix.qrSvg }}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              Pix de {view.amountLabel} · protocolo {view.protocolNumber}
            </p>
            <label className="text-xs text-muted-foreground">
              Chave Pix (copia e cola)
              <textarea
                readOnly
                value={view.pix.copyPaste}
                rows={3}
                className="mt-1 w-full resize-none rounded-md border bg-muted/40 p-2 font-mono text-xs text-foreground"
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyKey}>
                <AdminIcon name="copy" className="h-4 w-4" />
                {copied ? "Copiado" : "Copiar a chave Pix"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadQr}
              >
                <AdminIcon name="download" className="h-4 w-4" /> Baixar o QR
                Code
              </Button>
              {view.canEmail && (
                <form action={sendAction}>
                  <input
                    type="hidden"
                    name="requestId"
                    value={view.requestId}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={sending}
                  >
                    <AdminIcon name="mail" className="h-4 w-4" />
                    {sending ? "Enviando..." : "Enviar ao cliente por e-mail"}
                  </Button>
                </form>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Mostre o QR Code na tela ou envie a imagem e a chave pelo
              WhatsApp. O cliente também vê o mesmo Pix na consulta do
              protocolo, onde pode enviar o comprovante.
            </p>
          </div>
        </div>
      )}

      <details className="rounded-lg border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">
          Como fazer
        </summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-foreground">
          <li>
            Confira o valor com a tabela de emolumentos vigente (o lembrete
            acima abre a tabela). O sistema já usa o item de prenotação da
            tabela cadastrada como vigente em Transparência.
          </li>
          <li>
            Clique em "Gerar o pagamento (Pix)" e mostre o QR Code ao cliente,
            ou baixe a imagem, copie a chave e envie a ele (e-mail ou WhatsApp).
          </li>
          <li>
            Pago na sua frente: confira no aplicativo ou no extrato do banco que
            o valor entrou (ou receba no caixa) e clique em "Pagamento conferido
            e concluído".
          </li>
          <li>
            Pago depois: o cliente envia o comprovante na consulta do protocolo;
            o pedido aparece em "Pagamentos a conferir". Confira e clique em
            "Pagamento conferido e concluído".
          </li>
          <li>
            Confirmado o pagamento, o título vai para a análise (qualificação):
            depois vem a exigência ou o resultado positivo, e só então o valor
            do ato.
          </li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Fonte: a prenotação é o lançamento do título no Protocolo, que fixa a
          ordem de apresentação (Lei nº 6.015/1973, arts. 12 e 182, no Registro
          de Imóveis; art. 146, em Títulos e Documentos). O valor é o do item de
          prenotação da tabela de emolumentos vigente.
        </p>
      </details>
    </section>
  );
}

/**
 * The requerimento reminder (decision of 22/11/2026): it is mandatory.
 * Signed here, in front of the clerk; taken away to sign, it comes back with
 * the signature recognised (firma reconhecida) or signed digitally.
 */
export function RequerimentoReminder({
  printHref,
  downloadHref,
}: {
  printHref: string;
  downloadHref: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <AdminIcon
          name="signature"
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
        />
        <div className="text-sm">
          <h3 className="text-base font-semibold text-foreground">
            O requerimento é obrigatório
          </h3>
          <p className="mt-1 text-foreground">
            Imprima e peça ao cliente para assinar aqui, à sua vista, conferindo
            o documento de identidade dele. Se ele levar para assinar fora do
            cartório, o requerimento só vale com a{" "}
            <strong>firma reconhecida</strong> (ou assinado digitalmente, pelo
            gov.br ou com certificado ICP-Brasil).
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={printHref}
          target="_blank"
          rel="noopener"
          className={buttonVariants()}
        >
          <AdminIcon name="printer" className="h-4 w-4" /> Imprimir para assinar
        </a>
        <a
          href={downloadHref}
          className={buttonVariants({ variant: "outline" })}
        >
          <AdminIcon name="download" className="h-4 w-4" /> Baixar para enviar
          ao cliente
        </a>
      </div>
    </section>
  );
}
