"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  COOKIE_NOTICE_COOKIE,
  COOKIE_NOTICE_MAX_AGE_SECONDS,
} from "../_lib/cookie-notice.ts";
import { Icon } from "./icon.tsx";

/**
 * Acknowledgement, not opt-in: the site only sets essential cookies, so
 * there is nothing to accept or decline: see cookie-consent spec, "Aviso de
 * cookies na primeira visita". Rendered only when the server finds no prior
 * acknowledgement (see layout.tsx), so this never flashes for a return visit.
 */
export function CookieNotice() {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const dismiss = () => {
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari/Firefox support.
    document.cookie = `${COOKIE_NOTICE_COOKIE}=1; max-age=${COOKIE_NOTICE_MAX_AGE_SECONDS}; path=/; samesite=lax`;
    setAcknowledged(true);
    // The refresh below lands keyboard focus on <body>; hand it to the page
    // heading instead so tabbing resumes from a predictable place.
    const heading = document.querySelector<HTMLElement>("main h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    // The chat widget waits for this acknowledgement (see layout.tsx), and
    // the layout is server-rendered: refresh so it picks up the cookie and
    // mounts the chat without a manual reload.
    router.refresh();
  };

  if (acknowledged) return null;

  return (
    // On a phone the notice is a flush bottom strip, as short as it can be,
    // so it stops covering the form the citizen was reading; from md up it is
    // a compact card in the bottom-right corner, where the chat widget will
    // live once the notice is acknowledged: the two never coexist. The
    // layout is the design's (Claude Design project 558c4556, "Banner de
    // Cookies", variant A): icon column on the left, and title, text and
    // actions on one axis beside it. The sizes are the site's own card and
    // button scale, not the mock's standalone values.
    <section
      aria-label="Aviso de cookies"
      data-cookie-notice
      className="fixed inset-x-0 bottom-0 z-30 animate-notice-rise border-t border-brand-border bg-brand-card p-4 shadow-lg motion-reduce:animate-none md:inset-x-auto md:bottom-8 md:right-8 md:max-w-xl md:rounded-2xl md:border md:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft md:flex">
          <Icon
            name="shield"
            className="h-4.5 w-4.5 text-brand-accent"
            strokeWidth={1.9}
          />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-bold text-brand-primary">
            Sua privacidade
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-brand-muted">
            Este site usa apenas cookies essenciais ao seu funcionamento: nada
            de rastreamento ou publicidade.
          </p>
          <div className="mt-3 flex items-center gap-4 md:mt-3.5">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-soft"
            >
              Entendi
            </button>
            <Link
              href="/privacidade"
              className="text-[13px] font-semibold text-brand-primary-soft hover:text-brand-primary"
            >
              Política de privacidade
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
