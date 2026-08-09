"use client";

import { useState } from "react";
import { Icon } from "./icon.tsx";

/**
 * The protocol and the access key, at the one moment the key exists.
 *
 * It is the loudest block on every confirmation screen in the site because
 * nothing can bring the key back: the office stores a hash of it, and the
 * citizen has no account to recover it from.
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-brand-accent-line bg-brand-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-brand-accent">
          {label}
        </div>
        <div className="break-all text-[16.5px] font-bold tracking-wide text-brand-primary">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          );
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-2.5 py-1.5 text-[11.5px] font-bold text-brand-primary-soft"
      >
        <Icon name="copy" className="h-3 w-3" strokeWidth={2} />
        {copied ? "copiado" : "copiar"}
      </button>
    </div>
  );
}

export function ProtocolReveal({
  protocolNumber,
  accessKey,
  protocolLabel = "Protocolo",
  children,
  className,
}: {
  protocolNumber: string;
  /** Absent for the anonymous manifestation: there is no key to show. */
  accessKey?: string;
  /** The ombudsman calls it a registration number, not a protocol. */
  protocolLabel?: string;
  /** What this channel says about the key, above the fields. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-[1.5px] border-brand-accent bg-brand-card p-4 ${className ?? "rounded-2xl"}`}
    >
      {children && (
        <div className="flex items-start gap-2.5">
          <Icon
            name="alert"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-alert"
            strokeWidth={2}
          />
          <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
            {children}
          </p>
        </div>
      )}
      <div className={`flex flex-col gap-2 ${children ? "mt-3" : ""}`}>
        <CopyField label={protocolLabel} value={protocolNumber} />
        {accessKey && <CopyField label="Chave de acesso" value={accessKey} />}
      </div>
    </div>
  );
}
