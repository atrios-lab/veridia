import { Toaster } from "sonner";
import { SERIF } from "@/lib/fonts.ts";
import { getTenant } from "@/lib/tenant.ts";

// The panel repaints with the tenant's published style, same brand tokens
// and serif the public site uses for it: see theme-admin-panel.
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
      <Toaster
        position="bottom-right"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "flex w-full items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold shadow-md",
            success: "bg-admin-success-bg text-admin-success-text",
            error: "bg-admin-error-bg text-admin-error-text",
          },
        }}
      />
    </div>
  );
}
