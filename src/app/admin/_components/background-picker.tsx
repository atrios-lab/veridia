"use client";

import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../_ui/button.tsx";
import {
  BACKGROUND_COOKIE,
  BACKGROUND_TINTS,
  type BackgroundTint,
  backgroundCss,
  MAX_INTENSITY,
} from "./theme.ts";

/**
 * Next to the sun and moon: the background's tint and how strong it is
 * (decision of 26/11/2026). It shows at once and is kept in a cookie, so
 * the next page arrives already in it, in the panel and in the RI.
 */
export function BackgroundPicker({
  initialTint,
  initialIntensity,
}: {
  initialTint: BackgroundTint;
  initialIntensity: number;
}) {
  const [open, setOpen] = useState(false);
  const [tint, setTint] = useState(initialTint);
  const [intensity, setIntensity] = useState(initialIntensity);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let style = document.getElementById("painel-fundo") as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = "painel-fundo";
      document.head.appendChild(style);
    }
    style.textContent = backgroundCss(tint, intensity);
    // biome-ignore lint/suspicious/noDocumentCookie: a UI preference the server layout reads back, as the theme's.
    document.cookie = `${BACKGROUND_COOKIE}=${tint}:${intensity}; path=/admin; max-age=31536000; samesite=lax`;
  }, [tint, intensity]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cor e intensidade do fundo"
        title="Cor e intensidade do fundo"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Palette aria-hidden />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-xs font-semibold">Cor do fundo</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(BACKGROUND_TINTS) as BackgroundTint[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTint(k);
                  if (intensity === 0) setIntensity(12);
                }}
                aria-pressed={tint === k}
                className={`rounded-md border px-2 py-1 text-xs ${tint === k ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {k === "padrao" ? "Escurecer" : BACKGROUND_TINTS[k].label}
              </button>
            ))}
          </div>
          <label
            htmlFor="fundo-intensidade"
            className="mt-3 block text-xs font-semibold"
          >
            Intensidade: {intensity}%
          </label>
          <input
            id="fundo-intensidade"
            type="range"
            min={0}
            max={MAX_INTENSITY}
            step={2}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="mt-1 w-full"
          />
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => {
                setTint("padrao");
                setIntensity(0);
              }}
            >
              Voltar ao padrão
            </button>
            <span className="text-xs text-muted-foreground">
              Vale neste computador
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
