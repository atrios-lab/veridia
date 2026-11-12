import type { Tenant } from "@/core/tenant/schema.ts";
import { initials, OfficeMark } from "./sidebar.tsx";

/**
 * The panel's shell for a person who has no session yet: the invite and
 * "nova senha" screens at /admin/redefinir-senha. Same institutional chrome
 * as AdminSidebar (selo, name, "Painel administrativo") but no navigation,
 * since every route it could point to would still refuse them: it is
 * replaced by the sentence explaining why. No "Sair" either: there is no session to end.
 *
 * On a phone it folds into a band across the top: with nothing to navigate
 * there is nothing for a drawer to hold, and 236px of a 375px screen was the
 * form's room. The explanation is left to the card below, which says the
 * same thing; the person shrinks to their initials.
 */
export function AdminLockedSidebar({
  tenant,
  explanation,
  person,
}: {
  tenant: Tenant;
  explanation: string;
  person: { name: string; roleLabel: string };
}) {
  return (
    <aside className="flex flex-none flex-col border-sidebar-border bg-sidebar text-sidebar-foreground max-md:border-b md:w-64 md:border-r">
      <div className="flex items-center gap-3 p-3 md:border-b md:border-sidebar-border">
        <div className="min-w-0 flex-1">
          <OfficeMark tenant={tenant} />
        </div>
        <span
          title={`${person.name} · ${person.roleLabel}`}
          className="relative flex size-8 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground md:hidden"
        >
          <span aria-hidden="true">{initials(person.name, "")}</span>
          <span className="sr-only">
            {person.name}, {person.roleLabel}
          </span>
        </span>
      </div>

      <div className="hidden flex-1 p-4 md:block">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {explanation}
        </p>
      </div>

      <div className="hidden items-center gap-2.5 border-t border-sidebar-border p-3 md:flex">
        <span className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(person.name, "")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{person.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {person.roleLabel}
          </p>
        </div>
      </div>
    </aside>
  );
}
