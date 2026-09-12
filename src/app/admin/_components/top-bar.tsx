import type { Role } from "@/core/auth/roles.ts";
import { isChatOpen } from "@/core/chat/hours.ts";
import { readChatAvailability } from "@/lib/chat.ts";
import { getTenant } from "@/lib/tenant.ts";
import { SearchTriggerButton } from "./global-search.tsx";
import { AdminIcon } from "./icon.tsx";
import { ROLE_LABELS } from "./role-labels.ts";
import { initials } from "./sidebar.tsx";
import { UserMenu } from "./user-menu.tsx";

/**
 * The drawer the mobile menu button opens. Shared with the dashboard layout,
 * which renders the drawer itself: `popovertarget` pairs them by id, so the
 * two do not have to sit next to each other in the tree.
 */
export const ADMIN_MENU_ID = "admin-menu";

/**
 * The one bar over every panel screen: the global search, the chat pill and
 * the person signed in. Rendered once by the dashboard layout, not by each
 * page, so a screen's own title moved into its content (see page-header.tsx)
 * and nothing here changes from one screen to the next.
 *
 * The chat pill answers "can a citizen write to me right now", the only
 * version of the question an operator glancing up is asking, so it reads the
 * switch and the hours rather than only the switch.
 */
export async function AdminTopBar({
  user,
}: {
  user: { name?: string | null; email: string; role: string };
}) {
  const tenant = await getTenant();
  const availability = await readChatAvailability(tenant.slug);
  const open = isChatOpen(availability, tenant, new Date());

  return (
    <header className="flex flex-none items-center gap-3.5 border-b border-admin-border bg-admin-card px-[30px] py-3">
      {/* The only way to the navigation on a phone, where the sidebar is a
          drawer instead of a column. */}
      <button
        type="button"
        popoverTarget={ADMIN_MENU_ID}
        className="-ml-1.5 flex cursor-pointer items-center rounded-lg p-1.5 text-admin-primary md:hidden"
      >
        <AdminIcon name="menu" className="h-5.5 w-5.5" />
        <span className="sr-only">Abrir menu do painel</span>
      </button>
      <div className="min-w-0 flex-1 md:max-w-[460px]">
        <SearchTriggerButton />
      </div>
      <span className="hidden flex-1 md:block" />
      <span
        className={`hidden items-center gap-[7px] rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap sm:inline-flex ${
          open
            ? "bg-admin-success-bg text-admin-success-text"
            : "bg-admin-readonly-bg text-admin-muted"
        }`}
      >
        <AdminIcon name="chat" className="h-[13px] w-[13px]" strokeWidth={2} />
        {open
          ? "Disponível para o chat"
          : availability === "auto"
            ? "Fora do horário de atendimento"
            : "Indisponível para o chat"}
      </span>
      <UserMenu
        name={user.name?.trim() || user.email}
        initials={initials(user.name, user.email)}
        roleLabel={ROLE_LABELS[user.role as Role] ?? "Painel"}
      />
    </header>
  );
}
