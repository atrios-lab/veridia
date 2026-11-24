import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { overdue, ROUTING_PURPOSE_LABELS } from "@/core/routing/routing.ts";
import { formatOfficeDayMonthTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { officePeopleWith, routedToMeWith } from "@/lib/routing.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { RoutedList, type RoutedRow } from "./routed-list.tsx";

export const metadata = { title: "Direcionados a mim" };

/**
 * "Direcionados a mim" (change direcionamento-interno-de-pedidos): what a
 * colleague sent me or my sector's queue, and what I sent nobody received
 * yet. Apart from "Sua mesa", which stays with what the citizen moved.
 */
export default async function RoutedToMePage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const me = {
    id: session.user.id,
    chatSector:
      (session.user as { chatSector?: string | null }).chatSector ?? null,
  };
  const [items, people] = await Promise.all([
    routedToMeWith(db, tenant.slug, tenant.attributions, me),
    officePeopleWith(db, tenant.slug),
  ]);
  const name = (id: string | null) =>
    (id && people.find((p) => p.id === id)?.name) || "Alguém da equipe";
  const now = new Date();
  const rows: RoutedRow[] = items.map((item) => ({
    routingId: item.routing.id,
    bucket: item.bucket,
    protocolNumber: item.protocolNumber,
    applicantName: item.applicantName,
    purpose: ROUTING_PURPOSE_LABELS[item.routing.purpose],
    sectorLabel: item.routing.sectorLabel,
    from:
      item.bucket === "sent"
        ? item.routing.toUserId
          ? `para ${name(item.routing.toUserId)}`
          : `para a fila do setor ${item.routing.sectorLabel ?? ""}`
        : item.routing.kind === "take"
          ? "você pegou"
          : `de ${name(item.routing.createdBy)}`,
    atLabel: formatOfficeDayMonthTime(item.routing.createdAt),
    received: Boolean(item.routing.receivedAt),
    priority: item.routing.priority,
    dueLabel: item.routing.dueAt
      ? formatOfficeDayMonthTime(item.routing.dueAt)
      : null,
    overdue: overdue(item.routing, now),
    note: item.routing.note,
  }));
  return (
    <>
      <AdminPageHeader
        title="Direcionados a mim"
        description="O que um colega mandou para você ou para a fila do seu setor. Separado da 'Sua mesa', que continua só com o que o cidadão moveu."
      />
      <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-8">
        <RoutedList rows={rows} />
      </main>
    </>
  );
}
