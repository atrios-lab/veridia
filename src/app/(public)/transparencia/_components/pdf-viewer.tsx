"use client";

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "../../_components/icon.tsx";

/**
 * The transparency page's PDF dialog: one native `<dialog>` for the whole
 * page, opened by any `PdfLink` inside the provider.
 *
 * Only on a computer. A phone's browser does not show a PDF inside an
 * <iframe> (Chrome on Android renders nothing, iOS shows the first page),
 * so there, and on any modified click (Ctrl/⌘/Shift, middle button), the
 * link is left to do what it always did: open the PDF in a new tab. Before
 * hydration, or without JavaScript, every link is still that plain link.
 *
 * The <iframe> needs the PDF routes to accept a frame from this origin:
 * `isFramablePdfPath` in src/lib/csp.ts and the matching X-Frame-Options
 * entry in next.config.ts. `<embed>`/`<object>` stay off the table:
 * object-src is 'none' and has no reason to change.
 */

/** "Computer": wide enough for a readable page, and a precise pointer. An
 * iPad passes the width but not the pointer, and its Safari shows a framed
 * PDF poorly, so it keeps the new tab. */
const DIALOG_MEDIA = "(min-width: 768px) and (pointer: fine)";

interface OpenPdf {
  href: string;
  title: string;
}

type Open = (pdf: OpenPdf, trigger: HTMLElement) => void;

const PdfViewerContext = createContext<Open | null>(null);

export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [pdf, setPdf] = useState<OpenPdf | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback<Open>((next, trigger) => {
    triggerRef.current = trigger;
    setPdf(next);
    setLoading(true);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (pdf && dialog && !dialog.open) dialog.showModal();
  }, [pdf]);

  const close = useCallback(() => ref.current?.close(), []);

  // Runs for every way out (button, Escape, backdrop): the src goes so the
  // browser's PDF viewer stops holding the file, and focus goes back to the
  // link that opened it. Safari never focuses a link on click, so the native
  // focus restore of a modal dialog would have nothing to return to.
  const onClose = useCallback(() => {
    setPdf(null);
    setLoading(false);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  return (
    <PdfViewerContext.Provider value={open}>
      {children}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click only closes on the backdrop; the keyboard closes with Escape, which <dialog> handles natively */}
      <dialog
        ref={ref}
        aria-labelledby="pdf-viewer-title"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto h-[calc(100dvh-3rem)] w-[min(64rem,calc(100vw-3rem))] max-h-none max-w-none overflow-hidden rounded-2xl border border-brand-border bg-brand-card p-0 text-brand-text backdrop:bg-black/55 open:flex open:flex-col"
      >
        {pdf && (
          <>
            <div className="flex flex-none items-center gap-3 border-b border-brand-border px-5 py-3">
              <Icon
                name="file"
                className="h-5 w-5 flex-none text-brand-accent"
              />
              <h2
                id="pdf-viewer-title"
                className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-primary"
              >
                {pdf.title}
              </h2>
              <a
                href={pdf.href}
                target="_blank"
                rel="noopener"
                className="btn btn-ghost btn-sm"
              >
                <Icon name="external" className="h-4 w-4" />
                Abrir em nova aba
              </a>
              <a href={pdf.href} download className="btn btn-secondary btn-sm">
                <Icon name="download" className="h-4 w-4" />
                Baixar
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="btn btn-ghost btn-sm"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1 bg-brand-tint">
              {loading && (
                <p className="absolute inset-0 grid place-items-center text-sm text-brand-muted">
                  Carregando PDF…
                </p>
              )}
              <iframe
                key={pdf.href}
                src={pdf.href}
                title={pdf.title}
                onLoad={() => setLoading(false)}
                className="relative h-full w-full border-0"
              />
            </div>
          </>
        )}
      </dialog>
    </PdfViewerContext.Provider>
  );
}

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * A link to a transparency PDF. A plain new-tab link everywhere the dialog
 * does not apply (see the top of this file); on a computer, a plain click
 * opens the dialog instead.
 */
export function PdfLink({
  href,
  title,
  className,
  "aria-label": ariaLabel,
  children,
}: {
  href: string;
  /** What the dialog shows as its heading and the <iframe> as its title. */
  title: string;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const open = useContext(PdfViewerContext);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        if (!open || isModifiedClick(event)) return;
        if (!window.matchMedia(DIALOG_MEDIA).matches) return;
        event.preventDefault();
        open({ href, title }, event.currentTarget);
      }}
    >
      {children}
    </a>
  );
}
