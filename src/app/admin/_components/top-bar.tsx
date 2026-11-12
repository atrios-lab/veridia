import { can, type Role } from "@/core/auth/roles.ts";
import { isChatOpen } from "@/core/chat/hours.ts";
import { readChatAvailability } from "@/lib/chat.ts";
import { getTenant } from "@/lib/tenant.ts";
import { Separator } from "../_ui/separator.tsx";
import { SidebarTrigger } from "../_ui/sidebar.tsx";
import { SearchTriggerButton } from "./global-search.tsx";
import { ROLE_LABELS } from "./role-labels.ts";
import { initials } from "./sidebar.tsx";
import { UserMenu } from "./user-menu.tsx";

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
  user: {
    name?: string | null;
    email: string;
    role: string;
    permissions?: readonly string[];
  };
}) {
  const tenant = await getTenant();
  const availability = await readChatAvailability(tenant.slug);
  const open = isChatOpen(availability, tenant, new Date());

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-none items-center gap-3 border-b bg-background px-4 md:px-6">
      {/* Collapses the sidebar to its icons; on a phone, where the sidebar
          is a drawer, it is the only way to the navigation. */}
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="my-4 hidden md:block" />
      <div className="min-w-0 flex-1 md:max-w-md">
        <SearchTriggerButton />
      </div>
      <span className="hidden flex-1 md:block" />
      {/* Only for someone who answers the chat: a course learner has no
          citizen writing to them. */}
      {can(user.role, "chat.manage", user.permissions) && (
        <span className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground sm:inline-flex">
          <span
            aria-hidden
            className={`size-2 flex-none rounded-full ${open ? "bg-success" : "bg-muted-foreground"}`}
          />
          {open
            ? "Disponível para o chat"
            : availability === "auto"
              ? "Fora do horário de atendimento"
              : "Indisponível para o chat"}
        </span>
      )}
      <UserMenu
        name={user.name?.trim() || user.email}
        initials={initials(user.name, user.email)}
        roleLabel={ROLE_LABELS[user.role as Role] ?? "Painel"}
      />
    </header>
  );
}
