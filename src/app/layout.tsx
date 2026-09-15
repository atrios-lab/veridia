import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { PAGE_META, siteTitle } from "@/core/tenant/seo.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";
import "./globals.css";

// The body face is the same for every office. Only the serif carries the
// brand, and the public layout picks it from the office's theme.
const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-brand-sans",
  display: "swap",
});

// Metadata lives in the root layout so every route inherits the office title
// and seal without repeating the lookup.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const origin = await getSiteOrigin();
  return {
    // The canonical of every route is its own path on the office's domain,
    // query string dropped: "./" is resolved by Next against the pathname
    // of the request being rendered, not against this layout's "/", so a
    // page need not repeat it. Without it, "/?utm_source=x" and
    // "/acompanhar?numero=..." each count as a page of their own to a
    // search engine, and it picks which one to show.
    metadataBase: new URL(origin),
    alternates: { canonical: "./" },
    // The home's title carries the kind of serventia and the town (see
    // siteTitle); the other pages keep the short name after their own.
    title: {
      default: siteTitle(tenant),
      template: `%s | ${tenant.name}`,
    },
    // The home's own description. Every public page overrides it through
    // publicMetadata; this is what any route without one falls back to.
    description: PAGE_META["/"].description(tenant),
    icons: { icon: tenant.logos.seal.light },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={publicSans.variable}>
      <body>{children}</body>
    </html>
  );
}
