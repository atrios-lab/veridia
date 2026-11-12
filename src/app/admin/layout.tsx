import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { rootMetadata } from "@/lib/root-metadata.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";
import { DARK, THEME_COOKIE } from "./_components/theme.ts";
import "./admin.css";

// The panel's one face, the same for every office (painel-neutro-shadcn).
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-panel-sans",
  display: "swap",
});

// Nothing under /admin is a page for a search engine: the login screen was
// showing up as "Entrar | <cartório>" in results. Set here so every panel
// route inherits it, and in the initial HTML, which is the copy the engine
// honours. robots.txt also blocks the crawl; this covers a link from outside.
export async function generateMetadata(): Promise<Metadata> {
  return {
    ...rootMetadata(await getTenant(), await getSiteOrigin()),
    robots: { index: false, follow: false },
  };
}

/**
 * The panel's root layout. It has its own `<html>`, apart from the site's,
 * so the panel's neutral theme and the site's office theme never meet: no
 * `data-theme` here, the office shows up in its seal and name only. Going
 * from the site to the panel is a full page load, which only happens at
 * sign-in and sign-out.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The theme the person chose (theme-toggle.tsx), applied here so the page
  // arrives in it.
  const dark = (await cookies()).get(THEME_COOKIE)?.value === DARK;
  return (
    <html
      lang="pt-BR"
      className={dark ? `${plexSans.variable} dark` : plexSans.variable}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg",
              success: "border-border bg-background text-success-text",
              error: "border-border bg-background text-destructive",
            },
          }}
        />
      </body>
    </html>
  );
}
