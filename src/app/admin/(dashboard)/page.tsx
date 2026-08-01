import { getTenant } from "@/lib/tenant.ts";

export const metadata = { title: "Painel" };

export default async function AdminHome() {
  const tenant = await getTenant();
  return (
    <main>
      <h1>Painel</h1>
      <p>Serventia: {tenant.name}</p>
    </main>
  );
}
