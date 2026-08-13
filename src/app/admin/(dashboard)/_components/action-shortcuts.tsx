import Link from "next/link";
import type { AdminIconName } from "../../_components/icon.tsx";
import { AdminIcon } from "../../_components/icon.tsx";

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
          className="flex items-center gap-3 rounded-[12px] border border-admin-border bg-admin-card px-4 py-3.5 hover:border-admin-primary"
        >
          <span
            className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] ${
              index === 0 ? "bg-admin-primary" : "bg-admin-surface"
            }`}
          >
            <AdminIcon
              name={shortcut.icon}
              className={`h-4 w-4 ${index === 0 ? "text-white" : "text-admin-primary-soft"}`}
              strokeWidth={2}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold leading-tight text-admin-primary">
              {shortcut.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-admin-faint">
              {shortcut.caption}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
