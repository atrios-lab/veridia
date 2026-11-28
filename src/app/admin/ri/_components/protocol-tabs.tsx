import Link from "next/link";

export type ProtocolTab = "titulos" | "dias" | "livro" | "indice";

const TABS: { key: ProtocolTab; label: string; href: string }[] = [
  { key: "titulos", label: "Títulos", href: "/admin/ri/protocolo" },
  {
    key: "dias",
    label: "Encerramento dos dias",
    href: "/admin/ri/protocolo/dias",
  },
  {
    key: "livro",
    label: "Livro, folhas e impressão",
    href: "/admin/ri/protocolo?aba=livro",
  },
  { key: "indice", label: "Índice", href: "/admin/ri/protocolo/indice" },
];

/**
 * The four parts of the Protocolo, always in the same place (decision of
 * 28/11/2026): the títulos of the day first; the book, its folhas and the
 * printing in a tab of their own. Each tab has its own address, so a
 * reminder leads straight to it.
 */
export function ProtocolTabs({
  active,
  titles,
  pendingDays,
}: {
  active: ProtocolTab;
  /** Títulos in the book. */
  titles?: number;
  /** Days before today still open. */
  pendingDays?: number;
}) {
  const badge: Partial<Record<ProtocolTab, { text: string; warn: boolean }>> = {
    ...(titles
      ? {
          titulos: {
            text: titles.toLocaleString("pt-BR"),
            warn: false,
          },
        }
      : {}),
    ...(pendingDays
      ? {
          dias: {
            text: `${pendingDays} ${pendingDays === 1 ? "pendente" : "pendentes"}`,
            warn: true,
          },
        }
      : {}),
  };
  return (
    <nav
      aria-label="Partes do Protocolo"
      className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
    >
      {TABS.map((t) => {
        const on = t.key === active;
        const b = badge[t.key];
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {b && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.warn ? "bg-warning-soft text-warning-text" : "bg-primary-soft text-primary"}`}
              >
                {b.text}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
