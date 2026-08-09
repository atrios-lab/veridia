"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GlobalSearchResult,
  searchGlobally,
} from "@/app/admin/(dashboard)/search/actions.ts";
import { AdminIcon } from "./icon.tsx";

interface SearchOverlayContextValue {
  open: () => void;
  isOpen: boolean;
}

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(
  null,
);

/** The header's search field and the Ctrl K / Cmd K shortcut both open the
 * same overlay, mounted once by `GlobalSearchProvider` (this is how either
 * one reaches it without threading state through the server components
 * between them). */
export function useGlobalSearch(): SearchOverlayContextValue {
  const context = useContext(SearchOverlayContext);
  if (!context) {
    throw new Error(
      "useGlobalSearch precisa estar dentro de GlobalSearchProvider",
    );
  }
  return context;
}

export function GlobalSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open, isOpen }), [open, isOpen]);

  return (
    <SearchOverlayContext.Provider value={value}>
      {children}
      {isOpen && <SearchOverlay onClose={close} />}
    </SearchOverlayContext.Provider>
  );
}

/** The Visão geral header's search field: a button, not a real input (the
 * overlay owns the actual typing, this only opens it). */
export function SearchTriggerButton() {
  const { open } = useGlobalSearch();
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2.5 rounded-[10px] border border-admin-border bg-admin-input-bg px-3.5 py-2.5 text-left"
    >
      <AdminIcon
        name="search"
        className="h-[15px] w-[15px] flex-none text-admin-faint"
      />
      <span className="flex-1 truncate text-[13px] text-admin-faint">
        Buscar protocolo, CPF ou nome do interessado…
      </span>
      <span className="flex-none rounded-[5px] border border-admin-input-border bg-admin-card px-1.5 py-0.5 text-[10.5px] font-bold text-admin-muted">
        Ctrl K
      </span>
    </button>
  );
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const requestId = ++latestRequest.current;
    const timeout = setTimeout(() => {
      searchGlobally(trimmed).then((found) => {
        if (latestRequest.current !== requestId) return;
        setResults(found);
        setActiveIndex(0);
        setStatus("done");
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const goTo = useCallback(
    (result: GlobalSearchResult) => {
      onClose();
      router.push(result.href);
    },
    [onClose, router],
  );

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const target = results[activeIndex];
      if (target) {
        event.preventDefault();
        goTo(target);
      }
    }
  }

  const trimmed = query.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Fechar busca"
        onClick={onClose}
        className="fixed inset-0 z-0 cursor-default bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        onKeyDown={handleKeyDown}
        className="relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-admin-border bg-admin-card shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-admin-border px-4 py-3.5">
          <AdminIcon
            name="search"
            className="h-4 w-4 flex-none text-admin-faint"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar protocolo, CPF ou nome do interessado…"
            className="flex-1 bg-transparent text-[14px] text-admin-text placeholder:text-admin-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex-none rounded-[5px] border border-admin-input-border bg-admin-input-bg px-2 py-0.5 text-[10.5px] font-bold text-admin-muted"
          >
            Esc
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {trimmed.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-admin-muted">
              Digite um protocolo, CPF ou nome para buscar.
            </p>
          )}
          {trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH && (
            <p className="px-4 py-8 text-center text-[13px] text-admin-muted">
              Digite ao menos {MIN_QUERY_LENGTH} caracteres.
            </p>
          )}
          {status === "loading" && trimmed.length >= MIN_QUERY_LENGTH && (
            <p className="px-4 py-8 text-center text-[13px] text-admin-muted">
              Buscando…
            </p>
          )}
          {status === "done" && results.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-admin-muted">
              Nada encontrado para "{trimmed}".
            </p>
          )}
          {status === "done" &&
            results.map((result, index) => (
              <button
                key={`${result.kind}-${result.protocolNumber}`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => goTo(result)}
                className={`flex w-full items-center gap-3 border-b border-admin-border px-4 py-3 text-left text-[13px] last:border-b-0 ${
                  index === activeIndex ? "bg-admin-input-bg" : ""
                }`}
              >
                <span className="flex-none rounded-full bg-admin-surface px-2.5 py-0.5 text-[10.5px] font-bold text-admin-primary">
                  {result.channelLabel}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-admin-text">
                    {result.applicantName ?? "Não informado"}
                  </span>
                  <span className="block truncate text-[11.5px] text-admin-faint">
                    {result.protocolNumber} · {result.statusLabel}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
