import Link from "next/link";
import type { AdminIconName } from "../../_components/icon.tsx";
import { AdminIcon } from "../../_components/icon.tsx";
import { cn } from "../../_ui/cn.ts";

export interface ActionShortcut {
  key: string;
  href: string;
  icon: AdminIconName;
  title: string;
  caption: string;
}

/**
 * The row of one-click shortcuts for the day's most repeated tasks. Only
 * ever built from functionality that already exists (see admin-overview
 * spec, "Atalhos de ação apenas para funcionalidades existentes"): a shortcut
 * to something that isn't built yet (modelos de exigência, bloquear agenda)
 * has no entry here to omit, by construction.
 */
export function ActionShortcuts({
  shortcuts,
}: {
  shortcuts: ActionShortcut[];
}) {
  if (shortcuts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_348px]">
      {shortcuts.map((shortcut, index) => (
        <Link
          key={shortcut.key}
          href={shortcut.href}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-colors hover:bg-muted/50"
        >
          <span
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-lg",
              index === 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <AdminIcon
              name={shortcut.icon}
              className="h-4 w-4"
              strokeWidth={2}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-medium text-foreground">
              {shortcut.title}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {shortcut.caption}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
