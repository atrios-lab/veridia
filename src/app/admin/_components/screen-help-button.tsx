"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ScreenHelp } from "./screen-help.ts";

/**
 * The "!" beside a screen's title: what the screen is for, how to use it
 * and how to set it up, step by step (decision of 11/11/2026). Opens on
 * hover (mouse) and on click or tap; Escape or a click outside closes it.
 */
export function ScreenHelpButton({
  help,
  canConfigure,
  label = "Como funciona esta tela",
}: {
  help: ScreenHelp;
  /** The person may open the settings link. */
  canConfigure: boolean;
  /** What the "!" explains, for a screen reader (one per screen by default). */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          setPinned(false);
        }
        return;
      }
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only previews; the button inside opens it by keyboard and touch.
    <span
      ref={box}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setPinned((was) => !was);
          setOpen((was) => !(was && pinned));
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-admin-accent bg-admin-card font-serif text-[15px] font-bold text-admin-accent-ink hover:bg-admin-warning-soft-bg"
      >
        !
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          className="absolute top-[calc(100%+8px)] left-0 z-40 block max-h-[72vh] w-[min(460px,calc(100vw-48px))] overflow-y-auto rounded-[14px] border border-admin-border bg-admin-card p-4 text-left shadow-[0_12px_32px_rgba(9,24,16,0.18)]"
        >
          <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
            Para que serve
          </span>
          <span className="mt-1 block text-[13px] leading-relaxed text-admin-text">
            {help.purpose}
          </span>
          <span className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
            Como usar
          </span>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-admin-text">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {help.terms && help.terms.length > 0 && (
            <>
              <span className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
                O que significa
              </span>
              <dl className="mt-1 space-y-1.5 text-[12.5px] leading-relaxed text-admin-text">
                {help.terms.map((t) => (
                  <div key={t.term}>
                    <dt className="inline font-bold text-admin-primary">
                      {t.term}:
                    </dt>{" "}
                    <dd className="inline">{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {help.configure && (
            <>
              <span className="mt-3 block text-[11px] font-bold uppercase tracking-[0.08em] text-admin-accent">
                Como configurar
              </span>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-admin-text">
                {help.configure.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {canConfigure ? (
                <Link
                  href={help.configure.href}
                  className="btn btn-admin-primary btn-sm mt-2.5 inline-flex"
                >
                  Ir para: {help.configure.label}
                </Link>
              ) : (
                <span className="mt-2 block text-[11.5px] text-admin-muted">
                  Quem configura é o Tabelião/Registrador ou quem tem essa
                  permissão.
                </span>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
}
