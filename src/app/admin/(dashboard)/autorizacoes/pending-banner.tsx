import Link from "next/link";
import { decidesDeletions } from "@/core/deletion/official.ts";
import { db } from "@/db/index.ts";
import { pendingDeletionCountWith } from "@/lib/deletion-requests.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/** Tells the Tabelião there are deletions waiting for a decision. */
export async function PendingDeletionsBanner() {
  const session = await getSession();
  if (!session || !decidesDeletions(session.user.role ?? "")) return null;
  const tenant = await getTenant();
  const count = await pendingDeletionCountWith(db, tenant.slug);
  if (count === 0) return null;
  return (
    <Link
      href="/admin/autorizacoes"
      className="block rounded-xl border border-warning/50 bg-warning-soft px-4 py-3 text-sm font-medium text-warning-text"
    >
      {count === 1
        ? "1 pedido de exclusão de documento oficial espera a sua decisão."
        : `${count} pedidos de exclusão de documento oficial esperam a sua decisão.`}{" "}
      <span className="underline underline-offset-2">Abrir</span>
    </Link>
  );
}
