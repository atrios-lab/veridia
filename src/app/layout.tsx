import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
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
    title: {
      default: tenant.name,
      template: `%s | ${tenant.name}`,
    },
    description: tenant.subtitle,
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
