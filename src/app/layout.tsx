import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
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
  return {
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
