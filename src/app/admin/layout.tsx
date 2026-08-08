import { SERIF } from "@/lib/fonts.ts";
import { getTenant } from "@/lib/tenant.ts";

// The panel repaints with the tenant's published style, same brand tokens
// and serif the public site uses for it — see theme-admin-panel.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getTenant();
  const serif = SERIF[tenant.theme];

  return (
    <div
      data-theme={tenant.theme}
      className={`${serif.variable} min-h-screen bg-admin-surface text-admin-text`}
    >
      {children}
    </div>
  );
}
