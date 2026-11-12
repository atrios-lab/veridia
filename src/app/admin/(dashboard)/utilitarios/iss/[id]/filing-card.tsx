"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../../_ui/button.tsx";
import { Input } from "../../../../_ui/input.tsx";
import { Label } from "../../../../_ui/label.tsx";
import { type IssFormState, recordIssFiling } from "../actions.ts";

const STEP =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-3 border-b py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="break-words text-sm text-foreground">
          {value || (
            <span className="text-muted-foreground">
              Não configurado. Complete na configuração.
            </span>
          )}
        </p>
      </div>
      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              toast.error("Não foi possível copiar. Selecione o texto.");
            }
          }}
          aria-label={`Copiar ${label}`}
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
      )}
    </div>
  );
}

export interface FilingCardProps {
  id: string;
  mode: "portal" | "semut";
  portalUrl: string;
  fields: { key: string; label: string; value: string }[];
  pdfHref: string;
  receiptHref: string;
  filedOn: string;
  reference: string;
  today: string;
  canConfigure: boolean;
}

/**
 * How the declaration reaches the prefeitura, step by step: on its website
 * (the DAM's fields ready to copy, the PDF to attach) or at the SEMUT
 * counter (the PDF and a receipt to stamp). Either way, the office notes
 * when it went and the protocol it got.
 */
export function FilingCard(props: FilingCardProps) {
  const [state, action, pending] = useActionState<IssFormState, FormData>(
    recordIssFiling,
    { status: "idle" },
  );
  useEffect(() => {
    if (state.status === "saved") toast.success(state.message);
  }, [state]);
  const portal = props.mode === "portal";

  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          {portal ? "Enviar pelo site da prefeitura" : "Entregar na SEMUT"}
        </h2>
        {props.filedOn ? (
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-text">
            Entregue em {props.filedOn.split("-").reverse().join("/")}
            {props.reference ? ` · protocolo ${props.reference}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-text">
            Ainda não entregue
          </span>
        )}
      </div>

      {portal ? (
        <ol className="mt-3 flex flex-col gap-3 text-sm text-foreground">
          <li className="flex gap-2.5">
            <span className={STEP}>1</span>
            <div className="min-w-0 flex-1">
              <p>
                Abra a emissão de DAM no site da prefeitura e copie cada campo
                daqui.{" "}
                {props.portalUrl && (
                  <a
                    href={props.portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline"
                  >
                    Abrir o site da prefeitura
                  </a>
                )}
              </p>
              <div className="mt-2 rounded-lg bg-muted/50 px-3.5">
                {props.fields.map((field) => (
                  <CopyField
                    key={field.key}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </div>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className={STEP}>2</span>
            <p>
              Quando o site pedir os arquivos, anexe o{" "}
              <a
                href={props.pdfHref}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
              >
                PDF da declaração com os anexos
              </a>{" "}
              (ou o assinado digitalmente, baixado do Assinador).
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className={STEP}>3</span>
            <p>Anote abaixo a data e o número do DAM ou do protocolo.</p>
          </li>
        </ol>
      ) : (
        <ol className="mt-3 flex flex-col gap-3 text-sm text-foreground">
          <li className="flex gap-2.5">
            <span className={STEP}>1</span>
            <p>
              Imprima a{" "}
              <a
                href={props.pdfHref}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
              >
                declaração com os anexos
              </a>{" "}
              e assine (ou assine digitalmente e imprima).
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className={STEP}>2</span>
            <p>
              Imprima o{" "}
              <a
                href={props.receiptHref}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary underline"
              >
                protocolo de entrega
              </a>
              . Na SEMUT, peça carimbo, data e assinatura nele: ele fica com o
              cartório.
            </p>
          </li>
          <li className="flex gap-2.5">
            <span className={STEP}>3</span>
            <p>Anote abaixo a data e o número do protocolo.</p>
          </li>
        </ol>
      )}

      <form
        action={action}
        className="mt-4 grid grid-cols-1 items-end gap-3 border-t pt-4 md:grid-cols-[180px_1fr_auto]"
      >
        <input type="hidden" name="id" value={props.id} />
        <Label className="flex flex-col gap-1.5 text-sm font-medium text-foreground items-stretch leading-normal">
          Entregue em
          <Input
            type="date"
            name="entregue"
            max={props.today}
            defaultValue={props.filedOn}
            className="font-normal"
          />
        </Label>
        <Label className="flex flex-col gap-1.5 text-sm font-medium text-foreground items-stretch leading-normal">
          {portal ? "Nº do DAM ou do protocolo" : "Nº do protocolo"}
          <Input
            name="protocolo"
            defaultValue={props.reference}
            className="font-normal"
          />
        </Label>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Anotar entrega"}
        </Button>
        {state.status === "error" && (
          <p
            role="alert"
            className="text-xs font-semibold text-destructive md:col-span-3"
          >
            {state.message}
          </p>
        )}
      </form>
      {props.canConfigure && (
        <p className="mt-3 text-xs text-muted-foreground">
          A prefeitura recebe de outro jeito?{" "}
          <Link
            href="/admin/utilitarios/iss/configuracao"
            className="font-semibold text-primary underline"
          >
            Trocar na configuração
          </Link>
          .
        </p>
      )}
    </section>
  );
}
