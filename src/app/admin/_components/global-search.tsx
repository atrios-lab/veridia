"use client";

import { Search } from "lucide-react";
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
import { Badge } from "../_ui/badge.tsx";
import { Button } from "../_ui/button.tsx";
import { cn } from "../_ui/cn.ts";
import { Dialog, DialogContent } from "../_ui/dialog.tsx";
import { Kbd, KbdGroup } from "../_ui/kbd.tsx";

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

/** The top bar's search field: a button, not a real input (the overlay owns
 * the actual typing, this only opens it). Drawn as the prototype's field: a
 * wide outline button, the magnifier, what can be searched in the muted
 * tone (cut with an ellipsis when the bar is narrow) and the Ctrl K keys,
 * which never shrink. */
export function SearchTriggerButton() {
  const { open } = useGlobalSearch();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={open}
      className="w-full justify-start gap-2 px-3 font-normal"
    >
      <Search aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
        Buscar protocolo, CPF ou nome
      </span>
      <KbdGroup className="flex-none">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
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

  // Escape, the click outside and the focus trap come from the Dialog.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        aria-label="Busca global"
        initialFocus={inputRef}
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        className="top-[12vh] flex translate-y-0 flex-col gap-0 overflow-hidden p-0 shadow-lg sm:max-w-xl"
      >
        <div className="flex items-center gap-2.5 border-b px-4 py-3">
          <Search
            aria-hidden
            className="size-4 flex-none text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar protocolo, CPF ou nome do interessado…"
            className="h-8 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:shadow-none md:text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClose}
            className="flex-none text-muted-foreground"
          >
            Esc
          </Button>
        </div>
        <div className="max-h-90 overflow-y-auto">
          {trimmed.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digite um protocolo, CPF ou nome para buscar.
            </p>
          )}
          {trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Digite ao menos {MIN_QUERY_LENGTH} caracteres.
            </p>
          )}
          {status === "loading" && trimmed.length >= MIN_QUERY_LENGTH && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Buscando…
            </p>
          )}
          {status === "done" && results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
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
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left text-sm last:border-b-0",
                  index === activeIndex && "bg-muted",
                )}
              >
                <Badge variant="secondary" className="flex-none">
                  {result.channelLabel}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {result.applicantName ?? "Não informado"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {result.protocolNumber} · {result.statusLabel}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
