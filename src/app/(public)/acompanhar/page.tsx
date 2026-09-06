import { requireSection } from "../_lib/section.ts";
import { ProtocolTrilho } from "./protocol-trilho.tsx";

export const metadata = { title: "Acompanhar pedido" };

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
