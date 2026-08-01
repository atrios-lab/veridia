import type { Metadata } from "next";
import { getTenant } from "@/lib/tenant.ts";

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
    icons: { icon: tenant.logos.seal },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
