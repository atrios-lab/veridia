import Image from "next/image";
import type { Tenant } from "@/core/tenant/schema.ts";
import { initials } from "./sidebar.tsx";

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
    <aside className="flex flex-none flex-col bg-admin-primary md:w-[236px]">
      <div className="flex items-center gap-3 px-4 py-3.5 md:border-b md:border-white/12 md:px-[18px] md:py-5">
        <Image
          src={tenant.logos.seal.dark}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 flex-none object-contain"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-[15px] font-semibold leading-tight text-white md:whitespace-normal">
            {tenant.name}
          </span>
          <span className="block text-[10.5px] uppercase tracking-[0.08em] text-admin-on-dark-subtitle">
            Painel administrativo
          </span>
        </span>
        <span
          title={`${person.name} · ${person.roleLabel}`}
          className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full bg-admin-on-dark-accent text-xs font-bold text-admin-primary md:hidden"
        >
          <span aria-hidden="true">{initials(person.name, "")}</span>
          <span className="sr-only">
            {person.name}, {person.roleLabel}
          </span>
        </span>
      </div>

      <div className="hidden flex-1 px-[18px] py-5 md:block">
        <p className="text-[12.5px] leading-relaxed text-admin-on-dark-subtitle">
          {explanation}
        </p>
      </div>

      <div className="hidden items-center gap-2.5 border-t border-white/12 p-3.5 md:flex">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-admin-on-dark-accent text-xs font-bold text-admin-primary">
          {initials(person.name, "")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-white">
            {person.name}
          </p>
          <p className="truncate text-[11px] text-admin-on-dark-subtitle">
            {person.roleLabel}
          </p>
        </div>
      </div>
    </aside>
  );
}
