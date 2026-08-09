import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import type { RequestKind } from "@/core/request/kinds.ts";
import {
  activitySentence,
  CHANNEL_CHIP_LABELS,
  listRecentActivity,
  listStalledFulfilledRequirements,
  listUpcomingDataRightsDeadlines,
} from "@/lib/admin-overview.ts";
import { openCountByKind, openRequestCount } from "@/lib/service-request.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE, today } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../_components/page-header.tsx";

export const metadata = { title: "Painel" };

const ROUTE_BY_KIND: Record<RequestKind, string> = {
  "service-request": "/admin/pedidos",
  appointment: "/admin/agenda",
  "data-rights": "/admin/lgpd",
  ombudsman: "/admin/ouvidoria",
};

const CARD_LABELS: Record<RequestKind, { title: string; caption: string }> = {
  "service-request": {
    title: "Pedidos de serviço",
    caption: "pendentes de ação",
  },
  "data-rights": {
    title: "Requerimentos LGPD",
    caption: "aguardando resposta",
  },
  ombudsman: { title: "Ouvidoria", caption: "aguardando resposta" },
  appointment: { title: "Agenda de atendimentos", caption: "em aberto" },
};

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: OFFICE_TIME_ZONE,
    }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(name: string | null | undefined, email: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || email;
}

export default async function AdminHome() {
  const session = await getSession();
  if (!session) return null;
  const tenant = await getTenant();
  const role = session.user.role ?? "";

  const canRequests = can(role, "requests.manage");
  const canChannels = can(role, "channels.manage");
  const kinds: RequestKind[] = [
    ...(canRequests ? (["service-request"] as const) : []),
    ...(canChannels
      ? (["appointment", "ombudsman", "data-rights"] as const)
      : []),
  ];

  const [counts, activity, dataRightsDeadlines, stalled] = await Promise.all([
    Promise.all(
      kinds.map(
        async (kind) =>
          [
            kind,
            kind === "service-request"
              ? await openRequestCount(tenant.slug)
              : await openCountByKind(tenant.slug, kind),
          ] as const,
      ),
    ),
    listRecentActivity(tenant.slug, kinds, 8),
    canChannels
      ? listUpcomingDataRightsDeadlines(tenant.slug, today())
      : Promise.resolve([]),
    canRequests
      ? listStalledFulfilledRequirements(tenant.slug)
      : Promise.resolve([]),
  ]);
  const countByKind = new Map(counts);

  return (
    <>
      <AdminPageHeader
        title={`${greeting()}, ${firstName(session.user.name, session.user.email)}`}
      />
      <main className="flex flex-col gap-5.5 px-[30px] py-7">
        {kinds.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kinds.map((kind) => (
              <Link
                key={kind}
                href={ROUTE_BY_KIND[kind]}
                className="rounded-[14px] border border-admin-border bg-admin-card p-5"
              >
                <span className="text-xs font-bold uppercase tracking-[0.04em] text-admin-muted">
                  {CARD_LABELS[kind].title}
                </span>
                <div className="mt-2.5 font-serif text-[34px] font-semibold text-admin-primary">
                  {countByKind.get(kind) ?? 0}
                </div>
                <div className="mt-0.5 text-[12.5px] text-admin-muted">
                  {CARD_LABELS[kind].caption}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="rounded-[14px] border border-admin-border bg-admin-card p-5.5">
            <h4 className="font-serif text-[16.5px] font-semibold text-admin-primary">
              Atividade recente
            </h4>
            {activity.length === 0 ? (
              <p className="mt-3 text-[13px] text-admin-muted">
                Nenhum evento registrado ainda.
              </p>
            ) : (
              <div className="mt-3.5 flex flex-col gap-3">
                {activity.map((entry, index) => (
                  <div
                    key={`${entry.action}-${entry.createdAt.toISOString()}-${index}`}
                    className="flex items-start gap-2.5"
                  >
                    <span className="flex-none rounded-full bg-admin-surface px-2.5 py-0.5 text-[10.5px] font-bold text-admin-primary">
                      {CHANNEL_CHIP_LABELS[entry.kind]}
                    </span>
                    <span className="flex-1 text-[13px] text-admin-text">
                      {entry.protocolNumber ? (
                        <Link
                          href={`${ROUTE_BY_KIND[entry.kind]}/${encodeURIComponent(entry.protocolNumber)}`}
                          className="hover:underline"
                        >
                          {activitySentence(entry)}
                        </Link>
                      ) : (
                        activitySentence(entry)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[14px] border border-admin-border bg-admin-surface p-5">
            <h4 className="font-serif text-[15.5px] font-semibold text-admin-primary">
              Prazos a acompanhar
            </h4>
            {dataRightsDeadlines.length === 0 && stalled.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-admin-muted">
                Nenhum prazo pendente no momento.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2.5">
                {dataRightsDeadlines.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/lgpd/${encodeURIComponent(item.protocolNumber)}`}
                    className="block rounded-[10px] border border-admin-border bg-admin-card px-3.5 py-3"
                  >
                    <div className="text-[12.5px] font-bold text-admin-primary">
                      {item.protocolNumber} ·{" "}
                      {item.applicantName ?? "Nome não informado"}
                    </div>
                    <div className="mt-0.5 text-[12px] font-semibold text-admin-error-text">
                      {item.daysLeft < 0
                        ? `Prazo legal vencido há ${-item.daysLeft} dia${item.daysLeft === -1 ? "" : "s"}`
                        : item.daysLeft === 0
                          ? "Prazo legal vence hoje"
                          : `Prazo legal vence em ${item.daysLeft} dia${item.daysLeft === 1 ? "" : "s"}`}
                    </div>
                  </Link>
                ))}
                {stalled.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/pedidos/${encodeURIComponent(item.protocolNumber)}`}
                    className="block rounded-[10px] border border-admin-border bg-admin-card px-3.5 py-3"
                  >
                    <div className="text-[12.5px] font-bold text-admin-primary">
                      {item.protocolNumber} ·{" "}
                      {item.applicantName ?? "Nome não informado"}
                    </div>
                    <div className="mt-0.5 text-[12px] font-semibold text-admin-warning-text">
                      Exigência cumprida. Retome a análise.
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
