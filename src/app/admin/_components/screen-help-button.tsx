"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { buttonVariants } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
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
        className="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary hover:bg-muted"
      >
        !
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          className="absolute top-full left-0 z-40 mt-2 block max-h-[72vh] w-[min(460px,calc(100vw-48px))] overflow-y-auto rounded-xl border bg-popover p-4 text-left text-popover-foreground shadow-lg"
        >
          <span className="block text-xs font-medium text-muted-foreground">
            Para que serve
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-foreground">
            {help.purpose}
          </span>
          <span className="mt-4 block text-xs font-medium text-muted-foreground">
            Como usar
          </span>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {help.terms && help.terms.length > 0 && (
            <>
              <span className="mt-4 block text-xs font-medium text-muted-foreground">
                O que significa
              </span>
              <dl className="mt-1 space-y-1.5 text-sm leading-relaxed text-foreground">
                {help.terms.map((t) => (
                  <div key={t.term}>
                    <dt className="inline font-semibold text-foreground">
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
              <span className="mt-4 block text-xs font-medium text-muted-foreground">
                Como configurar
              </span>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                {help.configure.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {canConfigure ? (
                <Link
                  href={help.configure.href}
                  className={cn(buttonVariants({ size: "sm" }), "mt-3")}
                >
                  Ir para: {help.configure.label}
                </Link>
              ) : (
                <span className="mt-2 block text-xs text-muted-foreground">
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
