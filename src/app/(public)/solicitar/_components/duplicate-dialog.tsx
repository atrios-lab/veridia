"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * Warns the citizen a request for this act and CPF is already open, with a
 * link to it instead of a second, competing protocol. Native `<dialog>` +
 * `showModal()`, the same shell the admin panel's confirmations use, but
 * styled with the public site's own brand tokens: `.dialog` in globals.css
 * is scoped to the admin theme's colors.
 */
export function DuplicateRequestDialog({
  protocolNumber,
  onClose,
}: {
  protocolNumber: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog?.isConnected) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="duplicate-request-title"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-brand-border bg-brand-card p-0 text-brand-text backdrop:bg-black/55"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="p-5">
        <h2
          id="duplicate-request-title"
          className="font-serif text-[17px] font-semibold text-brand-primary"
        >
          Você já tem um pedido em andamento
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-brand-text-soft">
          Notamos que você já possui um protocolo para esse mesmo serviço, o{" "}
          <strong className="text-brand-primary">{protocolNumber}</strong>,
          ainda em análise. Não é possível abrir um segundo pedido igual;
          acompanhe o que já existe.
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2.5 border-t border-brand-border p-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary btn-md"
        >
          Fechar
        </button>
        <Link
          href={`/protocolo?numero=${encodeURIComponent(protocolNumber)}`}
          className="btn btn-primary btn-md"
        >
          Ver meu protocolo
        </Link>
      </div>
    </dialog>
  );
}
