import Link from "next/link";
import { AdminPageHeader } from "../_components/page-header.tsx";

export const metadata = { title: "Painel" };

export default function AdminHome() {
  return (
    <>
      <AdminPageHeader title="Visão geral" />
      {/* The overview itself belongs to a later delivery: what it would
          summarise — service requests, the citizen channels, the agenda —
          has no screen in the panel yet. */}
      <main className="max-w-[960px] px-[30px] py-7">
        <p className="text-sm leading-relaxed text-admin-muted">
          As telas de operação chegam nas próximas entregas. Por enquanto, o que
          a serventia ajusta está em{" "}
          <Link href="/admin/configuracoes" className="underline">
            Configurações
          </Link>
          .
        </p>
      </main>
    </>
  );
}
