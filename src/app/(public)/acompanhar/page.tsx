import type { Metadata } from "next";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { ProtocolTrilho } from "./protocol-trilho.tsx";

const pageMetadata = publicMetadata("/acompanhar");

// The page itself is indexable (it is in the sitemap); a URL that already
// carries a protocol number is one citizen's request, and there is one such
// URL per request ever made. Noindex on those, in the initial HTML, is what
// keeps a search engine from filing an empty shell per number it finds
// linked somewhere. The canonical of both is the bare page.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}): Promise<Metadata> {
  const { numero } = await searchParams;
  const metadata = await pageMetadata();
  return numero ? { ...metadata, robots: { index: false } } : metadata;
}

export default async function AcompanharPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  await requireSection("consulta-protocolo");
  const { numero } = await searchParams;
  const initialNumber = numero?.trim().slice(0, 40);

  return <ProtocolTrilho initialNumber={initialNumber} />;
}
