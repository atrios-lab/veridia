"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { type IssFormState, recordIssFiling } from "../actions.ts";

const FIELD =
  "w-full rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3.5 py-2.5 text-[13.5px] text-admin-text outline-none focus:border-admin-primary-soft";
const STEP =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-admin-primary text-[12px] font-bold text-white";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-3 border-b border-admin-border py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-admin-muted">
          {label}
        </p>
        <p className="break-words text-[13.5px] text-admin-text">
          {value || (
            <span className="text-admin-muted">
              Não configurado. Complete na configuração.
            </span>
          )}
        </p>
      </div>
      {value && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              toast.error("Não foi possível copiar. Selecione o texto.");
            }
          }}
          className="btn btn-admin-secondary btn-sm shrink-0"
          aria-label={`Copiar ${label}`}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
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
    <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          {portal ? "Enviar pelo site da prefeitura" : "Entregar na SEMUT"}
        </h2>
        {props.filedOn ? (
          <span className="rounded-full bg-admin-success-bg px-3 py-1 text-[12px] font-semibold text-admin-success-text">
            Entregue em {props.filedOn.split("-").reverse().join("/")}
            {props.reference ? ` · protocolo ${props.reference}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-admin-warning-bg px-3 py-1 text-[12px] font-semibold text-admin-warning-text">
            Ainda não entregue
          </span>
        )}
      </div>

      {portal ? (
        <ol className="mt-3 flex flex-col gap-3 text-[13px] text-admin-text">
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
                    className="font-semibold text-admin-primary underline"
                  >
                    Abrir o site da prefeitura
                  </a>
                )}
              </p>
              <div className="mt-2 rounded-[12px] bg-admin-input-bg px-3.5">
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
                className="font-semibold text-admin-primary underline"
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
        <ol className="mt-3 flex flex-col gap-3 text-[13px] text-admin-text">
          <li className="flex gap-2.5">
            <span className={STEP}>1</span>
            <p>
              Imprima a{" "}
              <a
                href={props.pdfHref}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-admin-primary underline"
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
                className="font-semibold text-admin-primary underline"
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
        className="mt-4 grid grid-cols-1 items-end gap-3 border-t border-admin-border pt-4 md:grid-cols-[180px_1fr_auto]"
      >
        <input type="hidden" name="id" value={props.id} />
        <label className="flex flex-col gap-1.5 text-xs font-bold text-admin-primary">
          Entregue em
          <input
            type="date"
            name="entregue"
            max={props.today}
            defaultValue={props.filedOn}
            className={`${FIELD} font-normal`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-admin-primary">
          {portal ? "Nº do DAM ou do protocolo" : "Nº do protocolo"}
          <input
            name="protocolo"
            defaultValue={props.reference}
            className={`${FIELD} font-normal`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn btn-admin-primary btn-md"
        >
          {pending ? "Salvando..." : "Anotar entrega"}
        </button>
        {state.status === "error" && (
          <p
            role="alert"
            className="text-[12.5px] font-semibold text-admin-error-text md:col-span-3"
          >
            {state.message}
          </p>
        )}
      </form>
      {props.canConfigure && (
        <p className="mt-3 text-[12px] text-admin-muted">
          A prefeitura recebe de outro jeito?{" "}
          <Link
            href="/admin/utilitarios/iss/configuracao"
            className="font-semibold text-admin-primary underline"
          >
            Trocar na configuração
          </Link>
          .
        </p>
      )}
    </section>
  );
}
